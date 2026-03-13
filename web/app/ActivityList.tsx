'use client';

import ArbiterChat from './ArbiterChat';
import { createPortal } from 'react-dom';
import { X, MessageSquare, Shield, Clock, AlertTriangle, CheckCircle, XCircle, ArrowRight, Undo2, Banknote, Loader2, Snowflake, Flame } from 'lucide-react';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { formatUnits } from 'viem';
import { CONTRACT_ADDRESS, CONTRACT_ABI, USDC_ADDRESS, ERC20_ABI } from './constants';
import { useToast } from './Toast';
import { supabase } from './supabaseClient';

const ARC_RPC = 'https://rpc.testnet.arc.network';

async function getReceiptDirect(txHash: string): Promise<{ status: 'success' | 'failed' } | null> {
  try {
    const response = await fetch(ARC_RPC, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getTransactionReceipt', params: [txHash] }),
    });
    const data = await response.json();
    if (data.result) return { status: data.result.status === '0x1' ? 'success' : 'failed' };
    return null;
  } catch (err) { return null; }
}

async function waitForReceiptWithStatus(txHash: string, timeoutMs: number = 60000): Promise<{ status: 'success' | 'failed' }> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    const receipt = await getReceiptDirect(txHash);
    if (receipt) return receipt;
    await new Promise(r => setTimeout(r, 1500));
  }
  throw new Error('Transaction receipt timeout');
}

export default function ActivityList({ className = '' }: { className?: string }) {
  const { address, isConnected } = useAccount();
  const { showToast } = useToast();
  const { writeContractAsync } = useWriteContract();
  
  const [payments, setPayments] = useState<any[]>([]);
  const [verdictPayments, setVerdictPayments] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [activeChatPayment, setActiveChatPayment] = useState<any | null>(null);
  
  // Action Modals
  const [declineAction, setDeclineAction] = useState<any | null>(null);
  const [disputeAction, setDisputeAction] = useState<any | null>(null);
  const [resolveAction, setResolveAction] = useState<{ id: string, action: string, target: string, pType: number, label: string } | null>(null);
  const [resolveConfirmText, setResolveConfirmText] = useState('');

  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  useEffect(() => {
    const interval = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!resolveAction) setResolveConfirmText('');
  }, [resolveAction]);

  const loadFromDatabase = useCallback(async () => {
    if (!address) {
      setIsLoading(false);
      return;
    }
    
    try {
      const userAddr = address.toLowerCase();
      
      const [paymentsRes, verdictsRes] = await Promise.all([
          supabase.from('escrow_payments').select('*').or(`sender.eq.${userAddr},receiver.eq.${userAddr},arbiter.eq.${userAddr}`),
          supabase.from('arbiter_chat').select('payment_id').ilike('message', 'VERDICT RENDERED%')
      ]);

      if (paymentsRes.error) throw paymentsRes.error;

      if (verdictsRes.data) {
          setVerdictPayments(new Set(verdictsRes.data.map(v => String(v.payment_id))));
      }

      if (paymentsRes.data) {
        const sortedData = paymentsRes.data.sort((a: any, b: any) => Number(b.id) - Number(a.id));

        const formatted = sortedData.map((d: any) => ({
          id: d.id, sender: d.sender, receiver: d.receiver, arbiter: d.arbiter,
          amount: d.amount, bondAmount: d.bond_amount, deadline: d.deadline, 
          availableAt: d.available_at, pType: d.p_type, status: d.status, isDeclined: d.is_declined,
          resolvedTo: d.resolved_to
        }));
        setPayments(formatted);
      }
    } catch (e) {
      console.warn("Background sync delayed");
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    if (address) {
      setIsLoading(true);
      loadFromDatabase();
      const interval = setInterval(() => loadFromDatabase(), 5000);
      return () => clearInterval(interval);
    } else {
      setIsLoading(false);
    }
  }, [address, loadFromDatabase]);

  const handleDecline = async (id: string) => {
    try {
      await supabase.from('escrow_payments').update({ is_declined: true }).eq('id', id);
      await supabase.from('arbiter_chat').delete().eq('payment_id', id);
      showToast('success', 'Escrow Declined', 'The sender has been notified.');
      loadFromDatabase();
    } catch (e) {
      showToast('error', 'Failed to decline');
    }
    setDeclineAction(null);
  };

  const truncateAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const formatTimeRemaining = (targetTime: number) => {
    const remaining = targetTime - now;
    if (remaining <= 0) return 'Available';
    const hrs = Math.floor(remaining / 3600);
    const mins = Math.floor((remaining % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m ${remaining % 60}s`;
  };

  const executeAction = async (action: string, id: string, pType?: number, amount?: string, targetAddress?: string) => {
    try {
        let fnName = '';
        let args: any[] = [BigInt(id)];

        if (action === 'accept') {
            if (pType === 3 && window.ethereum) { 
                showToast('info', 'Checking Bond', 'Verifying security deposit...');
                const { ethers } = await import('ethers');
                const provider = new ethers.BrowserProvider(window.ethereum as any);
                const signer = await provider.getSigner();
                const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI as any, signer);
                const allowance = await usdc.allowance(address, CONTRACT_ADDRESS);
                const requiredBond = BigInt(amount || '0');
                if (allowance < requiredBond) {
                    showToast('info', 'Approval Required', 'Please approve the USDC bond amount.');
                    const tx = await usdc.approve(CONTRACT_ADDRESS, ethers.MaxUint256);
                    await tx.wait();
                    showToast('success', 'Bond Approved!', 'Now processing your acceptance...');
                }
                fnName = 'acceptBondedPayment';
            } else {
                fnName = 'acceptMediatedPayment';
            }
        }
        else if (action === 'claim') fnName = 'claimTimelockedPayment';
        else if (action === 'release') fnName = 'releasePayment';
        else if (action === 'reclaim') fnName = 'reclaimExpiredPayment';
        else if (action === 'dispute') fnName = 'disputePayment';
        else if (action === 'slash') fnName = 'slashBondedPayment'; 
        else if (action === 'resolve_sender' || action === 'resolve_receiver') {
            fnName = 'resolveDispute';
            args = [BigInt(id), targetAddress as string];
        }
        else return;

        const hash = await writeContractAsync({ 
            address: CONTRACT_ADDRESS as `0x${string}`, 
            abi: CONTRACT_ABI, 
            functionName: fnName as any, 
            args: args as any 
        });
        
        showToast('info', 'Transaction Submitted', 'Waiting for confirmation...');
        const receipt = await waitForReceiptWithStatus(hash);
        
        if (receipt.status === 'success') {
            showToast('success', 'Action Successful!', `https://testnet.arcscan.app/tx/${hash}`, 'View Explorer');
            
            let updatedStatus = action === 'accept' ? 1 : ((action === 'dispute' || action === 'slash') ? 2 : 3);
            if (action === 'reclaim') updatedStatus = 4;
            if (action === 'slash') updatedStatus = 3; 

            let updatedResolvedTo = null;
            if (action === 'slash') {
                updatedResolvedTo = '0x0000000000000000000000000000000000000000'; 
            } else if (action === 'resolve_sender' || action === 'resolve_receiver') {
                updatedResolvedTo = targetAddress?.toLowerCase() || null;
            }

            try {
                const { ethers } = await import('ethers');
                const provider = new ethers.BrowserProvider(window.ethereum as any);
                const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI as any, provider);
                const p = await contract.getPayment(BigInt(id));
                updatedStatus = Number(p[11]);
                const onChainResolvedTo = p[13]?.toLowerCase();
                if (onChainResolvedTo && onChainResolvedTo !== '0x0000000000000000000000000000000000000000') {
                    updatedResolvedTo = onChainResolvedTo;
                }
            } catch(e) {}

            const updatePayload: any = { status: updatedStatus };
            if (updatedResolvedTo) updatePayload.resolved_to = updatedResolvedTo;
            await supabase.from('escrow_payments').update(updatePayload).eq('id', id);

            if (['resolve_sender', 'resolve_receiver', 'release', 'reclaim', 'claim'].includes(action)) {
                await supabase.from('arbiter_chat').delete().eq('payment_id', id);

                if (action === 'resolve_sender' || action === 'resolve_receiver') {
                    const verdictMsg = action === 'resolve_sender' 
                        ? 'VERDICT RENDERED: The Arbiter has refunded the Sender. This dispute is now officially closed.' 
                        : 'VERDICT RENDERED: The Arbiter has released funds to the Receiver. This dispute is now officially closed.';
                    
                    await supabase.from('arbiter_chat').insert([{
                        payment_id: id,
                        sender_address: address?.toLowerCase(),
                        message: verdictMsg,
                        file_url: null,
                    }]);
                }
            }
            
            loadFromDatabase();
        } else {
            showToast('error', 'Transaction Failed');
        }
    } catch (e) {
        showToast('error', 'Action Cancelled or Failed');
    }
  };

  const getStatusDisplay = (p: any, isSender: boolean, isReceiver: boolean, isArbiter: boolean) => {
    if (p.isDeclined) return { text: 'Declined', color: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20', icon: XCircle };

    const status = p.status;
    const isDisputed = status === 2;
    const isTimelocked = p.pType === 1;
    const availableAt = Number(p.availableAt);
    const deadline = Number(p.deadline);
    const isCoolingOff = status === 0 && now < availableAt;
    const isExpired = status === 0 && now > deadline;

    if (status === 4) return { text: 'Refunded', color: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20', icon: XCircle };
    if (status === 3) {
      if (p.pType === 3 && p.resolvedTo === "0x0000000000000000000000000000000000000000") {
          return { text: 'Slashed', color: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20', icon: Flame };
      }
      return { text: 'Completed', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20', icon: CheckCircle };
    }
    
    if (isDisputed) return { text: 'In Dispute', color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20', icon: AlertTriangle };

    if (status === 1) return { text: 'Active', color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/20', icon: Shield };

    if (status === 0) {
      if (isExpired) return { text: 'Expired', color: 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700', icon: Clock };
      if (isTimelocked && isCoolingOff) return { text: `Locked: ${formatTimeRemaining(availableAt)}`, color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/20', icon: Snowflake };
      
      if (isTimelocked && !isCoolingOff) {
        if (isReceiver) {
          return { text: 'Ready to Claim', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20', icon: CheckCircle };
        }
        return { text: 'Awaiting Claim', color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20', icon: Clock };
      }
      
      return { text: 'Awaiting Action', color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20', icon: Clock };
    }

    return { text: 'Unknown', color: 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800', icon: Clock };
  };

  const getActionButtons = (p: any, isSender: boolean, isReceiver: boolean, isArbiter: boolean) => {
    if (p.isDeclined) return null;

    if (p.status === 2) {
      if (isArbiter) {
        return (
            <div className="flex items-center gap-2">
                <button onClick={() => setResolveAction({ id: p.id, action: 'resolve_sender', target: p.sender, pType: p.pType, label: 'Sender' })} className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-300 dark:hover:border-rose-500/50 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-xs font-bold rounded-xl transition-all shadow-sm dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)] flex items-center gap-1.5">
                    <X size={15} strokeWidth={2.5} /> Refund Sender
                </button>
                <button onClick={() => setResolveAction({ id: p.id, action: 'resolve_receiver', target: p.receiver, pType: p.pType, label: 'Receiver' })} className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-300 dark:hover:border-emerald-500/50 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-xs font-bold rounded-xl transition-all shadow-sm dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)] flex items-center gap-1.5">
                    <CheckCircle size={15} strokeWidth={2.5} /> Pay Receiver
                </button>
            </div>
        );
      }
      return null;
    }

    const isTimelocked = p.pType === 1;
    const isBonded = p.pType === 3;
    const availableAt = Number(p.availableAt);
    const deadline = Number(p.deadline);
    const isExpired = now > deadline;
    const isCoolingOff = now < availableAt;

    // THE FIX: Adding Decline options for all Pending (status === 0) Escrows including Timelocks
    if (p.status === 0) {
        if (isExpired && isSender) return <button onClick={() => executeAction('reclaim', p.id, p.pType, undefined, p.sender)} className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl transition-all border border-slate-300 dark:border-slate-600 shadow-sm dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)]">Reclaim</button>;
        
        if (isReceiver && !isExpired) {
            return (
                <div className="flex gap-2">
                    <button onClick={() => setDeclineAction(p)} className="px-4 py-2.5 bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-500/10 border border-slate-200 dark:border-slate-700 hover:border-rose-200 dark:hover:border-rose-500/30 text-slate-700 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-bold rounded-xl transition-all shadow-sm dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)]">Decline</button>
                    
                    {isTimelocked && !isCoolingOff && (
                        <button onClick={() => executeAction('claim', p.id, p.pType, undefined, p.receiver)} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-[0_2px_8px_rgba(79,70,229,0.3)] dark:shadow-[0_2px_12px_rgba(79,70,229,0.4)]">Claim</button>
                    )}
                    
                    {!isTimelocked && (
                        <button onClick={() => executeAction('accept', p.id, p.pType, p.bondAmount)} className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-[0_2px_8px_rgba(79,70,229,0.3)] dark:shadow-[0_2px_12px_rgba(79,70,229,0.4)]">{isBonded ? 'Post Bond' : 'Accept'}</button>
                    )}
                </div>
            );
        }
    }

    if (p.status === 1) {
        if (isSender) return (
            <div className="flex gap-2">
                <button onClick={() => executeAction('release', p.id, p.pType, undefined, p.receiver)} className="px-4 py-2.5 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 text-xs font-bold rounded-xl transition-all shadow-sm dark:shadow-[0_2px_8px_rgba(16,185,129,0.15)]">Release</button>
                <button onClick={() => setDisputeAction(p)} className="px-4 py-2.5 bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-500/10 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-200 dark:hover:border-rose-500/30 text-xs font-bold rounded-xl transition-all shadow-sm dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)]">Dispute</button>
            </div>
        );
        if (isReceiver && !isBonded) return <button onClick={() => setDisputeAction(p)} className="px-4 py-2.5 bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-500/10 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-200 dark:hover:border-rose-500/30 text-xs font-bold rounded-xl transition-all shadow-sm dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)]">Dispute</button>;
    }

    return null;
  };

  const filteredPayments = payments.filter(p => {
    if (filter === 'active') return p.status === 0 || p.status === 1 || p.status === 2;
    if (filter === 'completed') return p.status === 3 || p.status === 4 || p.isDeclined;
    return true;
  });

  if (isLoading) {
    return (
      <div className={`w-full flex justify-center py-12 ${className}`}>
        <Loader2 className="w-6 h-6 text-indigo-600 dark:text-indigo-400 animate-spin" />
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className={`w-full flex flex-col items-center justify-center py-16 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm dark:shadow-[0_8px_30px_rgba(0,0,0,0.4)] dark:ring-1 dark:ring-white/5 ${className}`}>
        <Banknote className="w-10 h-10 mb-3 opacity-50" />
        <p className="text-sm font-semibold">No activity found</p>
      </div>
    );
  }

  return (
    <div className={`w-full space-y-5 ${className} animate-fade-in`}>
      <div className="flex gap-2">
        {(['all', 'active', 'completed'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${filter === f ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm dark:shadow-[0_2px_10px_rgba(255,255,255,0.1)]' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 dark:shadow-sm'}`}>
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filteredPayments.map(p => {
          const isSender = address?.toLowerCase() === p.sender.toLowerCase();
          const isReceiver = address?.toLowerCase() === p.receiver.toLowerCase();
          const isArbiter = address?.toLowerCase() === p.arbiter.toLowerCase();
          const { text: statusText, color: statusColor, icon: StatusIcon } = getStatusDisplay(p, isSender, isReceiver, isArbiter);

          const hasArbiterVerdict = p.pType === 2 && verdictPayments.has(String(p.id));
          const isSlashed = p.pType === 3 && p.status === 3 && p.resolvedTo === "0x0000000000000000000000000000000000000000";
          
          const isReturned = p.isDeclined || p.status === 4 || (p.status === 3 && hasArbiterVerdict && p.resolvedTo?.toLowerCase() === p.sender.toLowerCase());

          let destAddress = p.receiver;
          let destLabel = 'To';
          let FlowIcon = ArrowRight;
          let flowColor = 'text-slate-300 dark:text-slate-600';
          let destLabelColor = 'text-slate-500 dark:text-slate-400';

          if (isSlashed) {
            destAddress = '0x0000...0000';
            destLabel = 'Slashed';
            flowColor = 'text-rose-300 dark:text-rose-500/50';
            destLabelColor = 'text-rose-500 dark:text-rose-400';
          } else if (isReturned) {
            destAddress = p.sender;
            destLabel = 'Refunded To';
            FlowIcon = Undo2;
            flowColor = 'text-amber-400 dark:text-amber-500/50';
            destLabelColor = 'text-amber-600 dark:text-amber-400';
          }

          const isDestMe = address?.toLowerCase() === (isSlashed ? '' : destAddress.toLowerCase());

          return (
            <div key={p.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center hover:border-indigo-300 dark:hover:border-indigo-500/50 transition-colors shadow-sm dark:shadow-[0_8px_30px_rgba(0,0,0,0.4)] dark:ring-1 dark:ring-white/5">
              <div className="space-y-3 w-full sm:w-auto">
                <div className="flex items-center gap-3">
                  <div className={`px-2.5 py-1 rounded-md border text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${statusColor}`}>
                    <StatusIcon size={12} /> {statusText}
                  </div>
                </div>
                
                <div className="flex items-center flex-wrap gap-2 sm:gap-4 text-xs font-mono text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase font-sans">From</span>
                    <span className={isSender ? 'text-indigo-600 dark:text-indigo-400 font-bold' : ''}>{truncateAddress(p.sender)}</span>
                  </div>
                  
                  <FlowIcon size={12} className={flowColor} />
                  
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[9px] font-bold uppercase font-sans ${destLabelColor}`}>{destLabel}</span>
                    <span className={isDestMe ? (isReturned ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-indigo-600 dark:text-indigo-400 font-bold') : ''}>
                        {isSlashed ? destAddress : truncateAddress(destAddress)}
                    </span>
                  </div>
                  
                  {p.pType === 2 && (
                    <>
                      <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">•</span>
                      <div className="flex items-center gap-1.5 mt-1 sm:mt-0">
                        <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase font-sans">Arbiter</span>
                        <span className={isArbiter ? 'text-amber-600 dark:text-amber-400 font-bold' : ''}>{truncateAddress(p.arbiter)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-3 border-t border-slate-100 dark:border-slate-800/50 sm:border-0 pt-3 sm:pt-0">
                <div className="text-right">
                  <div className="font-bold text-slate-900 dark:text-slate-100 font-mono text-lg sm:text-base">{(Number(p.amount) / 1e6).toFixed(2)} USDC</div>
                  {p.pType === 3 && <div className="text-[10px] text-slate-600 dark:text-slate-400 font-semibold uppercase mt-0.5">Bond: {(Number(p.bondAmount) / 1e6).toFixed(2)}</div>}
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-2.5">
                  {getActionButtons(p, isSender, isReceiver, isArbiter)}
                  {p.pType === 2 && p.status === 2 && (
                    <button 
                      onClick={() => setActiveChatPayment(p)} 
                      className="px-4 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-bold rounded-xl transition-all shadow-[0_2px_8px_rgba(79,70,229,0.3)] dark:shadow-[0_2px_12px_rgba(79,70,229,0.4)] flex items-center justify-center gap-1.5 active:scale-95"
                    >
                      <MessageSquare size={14} />
                      View Chat
                    </button>
                  )}
                  {hasArbiterVerdict && (p.status === 3 || p.status === 4) && (
                    <button 
                      onClick={() => setActiveChatPayment(p)} 
                      className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold rounded-xl transition-all shadow-sm dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)] flex items-center justify-center gap-1.5 active:scale-95"
                    >
                      <MessageSquare size={14} />
                      Transcript
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* DISPUTE ACTION MODAL */}
      {disputeAction && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-fade-in" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.8)] p-6 space-y-5 ring-1 ring-black/5 dark:ring-white/5">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center border ${disputeAction.pType === 3 ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-100 dark:border-rose-500/20 text-rose-500 dark:text-rose-400' : 'bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20 text-amber-500 dark:text-amber-400'}`}>
                {disputeAction.pType === 3 ? <Flame className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                {disputeAction.pType === 3 ? 'Slash & Burn Funds' : 'Initiate Arbitration'}
              </h2>
            </div>
            
            <div className={`p-4 rounded-2xl border ${disputeAction.pType === 3 ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800'}`}>
              <p className={`text-sm leading-relaxed text-center font-medium ${disputeAction.pType === 3 ? 'text-rose-800 dark:text-rose-300' : 'text-slate-800 dark:text-slate-300'}`}>
                {disputeAction.pType === 3 
                  ? "Warning: Disputing a Bonded payment will instantly slash the receiver's bond and burn the locked funds. This action is irreversible and neither party will receive the funds."
                  : "Warning: Disputing this payment will lock the funds and initiate the arbitration process. The assigned Arbiter will review the case and render a final verdict."}
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={() => setDisputeAction(null)} className="flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-wide text-slate-800 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border border-slate-300 dark:border-slate-700 shadow-sm">Cancel</button>
              <button 
                onClick={() => { 
                  executeAction(disputeAction.pType === 3 ? 'slash' : 'dispute', disputeAction.id, disputeAction.pType); 
                  setDisputeAction(null); 
                }} 
                className={`flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-wide text-white transition-all active:scale-95 ${disputeAction.pType === 3 ? 'bg-rose-600 hover:bg-rose-700 shadow-[0_2px_8px_rgba(225,29,72,0.3)]' : 'bg-amber-600 hover:bg-amber-700 shadow-[0_2px_8px_rgba(217,119,6,0.3)]'}`}
              >
                {disputeAction.pType === 3 ? 'Slash Funds' : 'Dispute'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {declineAction && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-fade-in" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.8)] p-6 space-y-5 ring-1 ring-black/5 dark:ring-white/5">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center border border-rose-100 dark:border-rose-500/20">
                <XCircle className="w-6 h-6 text-rose-500 dark:text-rose-400" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">Decline Payment</h2>
            </div>
            <p className="text-slate-800 dark:text-slate-300 text-sm leading-relaxed text-center font-medium">
              Are you sure you want to decline this escrow? This will return the funds to the sender and notify them.
            </p>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setDeclineAction(null)} className="flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-wide text-slate-800 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border border-slate-300 dark:border-slate-700 shadow-sm">Cancel</button>
              <button onClick={() => handleDecline(declineAction.id)} className="flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-wide bg-rose-600 text-white hover:bg-rose-700 transition-all shadow-[0_2px_8px_rgba(225,29,72,0.3)] active:scale-95">Decline</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {resolveAction && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-fade-in" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.8)] p-6 space-y-5 ring-1 ring-black/5 dark:ring-white/5">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center border ${resolveAction.action === 'resolve_sender' ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-100 dark:border-rose-500/20 text-rose-500 dark:text-rose-400' : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20 text-emerald-500 dark:text-emerald-400'}`}>
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Confirm Verdict</h2>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
              <p className="text-slate-800 dark:text-slate-300 text-sm leading-relaxed text-center font-medium">
                You are about to irreversibly disburse funds to the <strong className="text-slate-900 dark:text-slate-100">{resolveAction.label}</strong>.
              </p>
              <div className="bg-slate-200 dark:bg-slate-800 p-3 rounded-xl text-xs text-center font-mono text-slate-900 dark:text-slate-100 font-bold border border-slate-300 dark:border-slate-700 shadow-inner dark:shadow-black/20">
                {resolveAction.target}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-400 uppercase tracking-wider text-center block">
                Type <span className="text-slate-900 dark:text-slate-100">CONFIRM</span> to execute
              </label>
              
              <input
                autoFocus
                type="text" placeholder="CONFIRM" value={resolveConfirmText} 
                onChange={(e) => setResolveConfirmText(e.target.value.toUpperCase())}
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-3.5 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 font-mono text-base font-bold text-center uppercase focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-inner dark:shadow-black/20"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setResolveAction(null)} className="flex-1 py-3.5 rounded-xl font-bold text-sm uppercase tracking-wide text-slate-800 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border border-slate-300 dark:border-slate-700 shadow-sm">Cancel</button>
              <button 
                onClick={() => { executeAction(resolveAction.action, resolveAction.id, resolveAction.pType, undefined, resolveAction.target); setResolveAction(null); }} 
                disabled={resolveConfirmText !== 'CONFIRM'}
                className={`flex-1 py-3.5 rounded-xl font-bold text-sm uppercase tracking-wide transition-all shadow-[0_2px_8px_rgba(0,0,0,0.2)] ${resolveConfirmText === 'CONFIRM' ? (resolveAction.action === 'resolve_sender' ? 'bg-rose-600 hover:bg-rose-700 text-white active:scale-95 dark:shadow-[0_2px_12px_rgba(225,29,72,0.4)]' : 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95 dark:shadow-[0_2px_12px_rgba(16,185,129,0.4)]') : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-600 font-bold cursor-not-allowed shadow-none'}`}
              >
                Execute
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {activeChatPayment && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-fade-in" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden ring-1 ring-black/5 dark:ring-white/5">
            <div className="absolute top-4 right-4 z-50">
              <button 
                onClick={() => setActiveChatPayment(null)} 
                className="text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 p-2 rounded-full shadow-sm"
              >
                <X size={16} strokeWidth={3} />
              </button>
            </div>
            <ArbiterChat 
              paymentId={activeChatPayment.id} 
              currentUserAddress={address as string} 
              arbiterAddress={activeChatPayment.arbiter} 
              senderAddress={activeChatPayment.sender}
              receiverAddress={activeChatPayment.receiver}
              paymentStatus={activeChatPayment.status}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}