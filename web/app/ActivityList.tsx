'use client';

import ArbiterChat from './ArbiterChat';
import { createPortal } from 'react-dom';
import { X, MessageSquare, Shield, Clock, AlertTriangle, CheckCircle, XCircle, ArrowRight, Undo2, Loader2, Snowflake, Flame, Info, Copy, ExternalLink, Check } from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
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

export default function ActivityList({ className = '', onActivityUpdate }: { className?: string, onActivityUpdate?: () => void }) {
  const { address } = useAccount();
  const { showToast } = useToast();
  const { writeContractAsync } = useWriteContract();
  const [payments, setPayments] = useState<any[]>([]);
  const [verdictPayments, setVerdictPayments] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [activeChatPayment, setActiveChatPayment] = useState<any | null>(null);
  const [declineAction, setDeclineAction] = useState<any | null>(null);
  const [disputeAction, setDisputeAction] = useState<any | null>(null);
  const [resolveAction, setResolveAction] = useState<any | null>(null);
  const [resolveConfirmText, setResolveConfirmText] = useState('');
  
  const [declineConfirmText, setDeclineConfirmText] = useState('');
  
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTimeRemaining = (targetTime: number) => {
    const remaining = targetTime - now;
    if (remaining <= 0) return 'Expired';
    const hrs = Math.floor(remaining / 3600); const mins = Math.floor((remaining % 3600) / 60);
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m ${remaining % 60}s`;
  };

  const loadFromDatabase = useCallback(async () => {
    if (!address) return;
    try {
      const userAddr = address.toLowerCase();
      const [paymentsRes, anyChatRes] = await Promise.all([
          supabase.from('escrow_payments').select('*').or(`sender.eq.${userAddr},receiver.eq.${userAddr},arbiter.eq.${userAddr}`),
          supabase.from('arbiter_chat').select('payment_id')
      ]);
      if (anyChatRes.data) setVerdictPayments(new Set(anyChatRes.data.map(v => String(v.payment_id))));
      
      if (paymentsRes.data) {
        const sorted = paymentsRes.data.sort((a: any, b: any) => Number(b.id) - Number(a.id));
        setPayments(sorted.map((d: any) => ({
          id: d.id, sender: d.sender, receiver: d.receiver, arbiter: d.arbiter,
          amount: d.amount, bondAmount: d.bond_amount, deadline: d.deadline, 
          availableAt: d.available_at, pType: d.p_type, status: d.status, isDeclined: d.is_declined,
          resolvedTo: d.resolved_to, lastTxHash: d.last_tx_hash
        })));
      }
    } catch (e) {} finally { setIsLoading(false); }
  }, [address]);

  useEffect(() => { 
    if (address) { 
      setIsLoading(true); 
      loadFromDatabase(); 
      const interval = setInterval(loadFromDatabase, 15000); 
      return () => clearInterval(interval); 
    } 
  }, [address, loadFromDatabase]);

  const handleDecline = async (id: string) => {
    try {
      await supabase.from('escrow_payments').update({ is_declined: true }).eq('id', id);
      await supabase.from('arbiter_chat').delete().eq('payment_id', id);
      showToast('success', 'Escrow Declined', 'The sender has been notified.');
      loadFromDatabase();
      if (onActivityUpdate) onActivityUpdate();
    } catch (e) {
      showToast('error', 'Failed to decline');
    }
    setDeclineAction(null);
  };

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const truncateAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  
  const executeAction = async (action: string, id: string, pType?: number, amount?: string, targetAddress?: string) => {
    try {
        let fnName = ''; let args: any[] = [BigInt(id)];
        if (action === 'accept') {
            if (pType === 3) {
                const { ethers } = await import('ethers');
                const provider = new ethers.BrowserProvider(window.ethereum as any);
                const signer = await provider.getSigner();
                const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI as any, signer);
                const allowance = await usdc.allowance(address, CONTRACT_ADDRESS);
                if (allowance < BigInt(amount || '0')) {
                    showToast('info', 'Approval Required', 'Approve the bond in your wallet.');
                    const tx = await usdc.approve(CONTRACT_ADDRESS, ethers.MaxUint256); await tx.wait();
                }
                fnName = 'acceptBondedPayment';
            } else fnName = 'acceptMediatedPayment';
        }
        else if (action === 'claim') fnName = 'claimTimelockedPayment';
        else if (action === 'release') fnName = 'releasePayment';
        else if (action === 'reclaim') fnName = 'reclaimExpiredPayment';
        else if (action === 'dispute') fnName = 'disputePayment';
        else if (action === 'slash') fnName = 'slashBondedPayment';
        else if (action === 'resolve_sender' || action === 'resolve_receiver') { fnName = 'resolveDispute'; args = [BigInt(id), targetAddress as string]; }

        const hash = await writeContractAsync({ address: CONTRACT_ADDRESS as `0x${string}`, abi: CONTRACT_ABI, functionName: fnName as any, args: args as any });
        showToast('info', 'Submitted', 'Waiting for confirmation...');
        
        if ((await waitForReceiptWithStatus(hash)).status === 'success') { 
          showToast('success', 'Success!', 'Blockchain updated.'); 

          let updatedStatus = action === 'accept' ? 1 : ((action === 'dispute' || action === 'slash') ? 2 : 3);
          if (action === 'reclaim') updatedStatus = 4;
          if (action === 'slash') updatedStatus = 3;
          
          let updatedResolvedTo = null;
          if (action === 'slash') updatedResolvedTo = '0x0000000000000000000000000000000000000000'; 
          else if (action === 'resolve_sender' || action === 'resolve_receiver') updatedResolvedTo = targetAddress?.toLowerCase() || null;

          const updatePayload: any = { 
            status: updatedStatus,
            last_tx_hash: hash 
          };
          if (updatedResolvedTo) updatePayload.resolved_to = updatedResolvedTo;
          
          if (action === 'dispute') updatePayload.disputed_by = address?.toLowerCase();
          
          await supabase.from('escrow_payments').update(updatePayload).eq('id', id);

          setTimeout(() => {
              loadFromDatabase(); 
              if (onActivityUpdate) onActivityUpdate();
          }, 500);
        }
    } catch (e) { showToast('error', 'Failed'); }
  };

  const getStatusDisplay = (p: any, isSender: boolean, isReceiver: boolean, isStrictlyArbiter: boolean) => {
    if (p.isDeclined) return { text: 'Declined', color: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20', icon: XCircle };
    const status = p.status; const deadline = Number(p.deadline); const availableAt = Number(p.availableAt);
    
    if (status === 4) return { text: 'Refunded', color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20', icon: Undo2 };
    
    if (status === 3) {
      if (Number(p.pType) === 3 && p.resolvedTo === "0x0000000000000000000000000000000000000000") return { text: 'Slashed', color: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20', icon: Flame };
      return { text: 'Completed', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20', icon: CheckCircle };
    }
    
    if (status === 2) {
      if (isStrictlyArbiter) return { text: 'Awaiting Your Decision', color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20', icon: AlertTriangle };
      return { text: 'In Dispute', color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20', icon: AlertTriangle };
    }
    
    if (Number(p.pType) === 1 && now > deadline && deadline !== 0) {
      if (isStrictlyArbiter) return { text: 'No Action Needed Yet', color: 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700', icon: Shield };
      if (isSender && (status === 0 || status === 1)) return { text: 'Ready to Reclaim', color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20', icon: Undo2 };
      return { text: 'Expired', color: 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700', icon: Clock };
    }

    if (status === 1) {
      if (isStrictlyArbiter) return { text: 'No Action Needed Yet', color: 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700', icon: Shield };
      if (Number(p.pType) === 1) return { text: `Active: ${formatTimeRemaining(deadline)}`, color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/20', icon: Shield };
      
      // Makes active Mediated/Bonded escrows fully role-aware
      if (isSender) return { text: 'Action Required', color: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20', icon: AlertTriangle };
      if (isReceiver) return { text: 'Awaiting Sender', color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20', icon: Clock };
      
      return { text: 'Active', color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/20', icon: Shield };
    }
    
    if (status === 0) {
      if (isStrictlyArbiter) return { text: 'No Action Needed Yet', color: 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700', icon: Shield };
      
      if (Number(p.pType) === 1) {
        if (now < availableAt) return { text: `Locked: ${formatTimeRemaining(availableAt)}`, color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/20', icon: Snowflake };
        return isReceiver ? { text: 'Ready to Claim', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20', icon: CheckCircle } : { text: 'Awaiting Claim', color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20', icon: Clock };
      }
      
      if (isReceiver) return { text: 'Awaiting Action', color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20', icon: Clock };
      if (isSender) return { text: 'Awaiting Receiver', color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20', icon: Clock };
      
      return { text: 'Awaiting Action', color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20', icon: Clock };
    }
    return { text: 'Unknown', color: 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800', icon: Clock };
  };

  const getActionButtons = (p: any, isSender: boolean, isReceiver: boolean, isArbiter: boolean) => {
    if (p.isDeclined) return null;
    const isExpired = Number(p.pType) === 1 && now > Number(p.deadline) && Number(p.deadline) !== 0;
    const isCoolingOff = now < Number(p.availableAt);
    
    if (p.status === 2 && isArbiter) return (
      <div className="flex flex-wrap sm:flex-nowrap gap-2 mt-2 w-full sm:w-auto">
        <button onClick={() => setResolveAction({ id: p.id, action: 'resolve_sender', target: p.sender, label: 'Sender', pType: p.pType })} className="flex-1 sm:flex-none px-3 py-2 bg-white dark:bg-slate-800 border border-rose-300 dark:border-rose-500/50 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-xl hover:bg-rose-50 dark:hover:bg-rose-500/10 whitespace-nowrap">Refund Sender</button>
        <button onClick={() => setResolveAction({ id: p.id, action: 'resolve_receiver', target: p.receiver, label: 'Receiver', pType: p.pType })} className="flex-1 sm:flex-none px-3 py-2 bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-500/50 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-500/10 whitespace-nowrap">Pay Receiver</button>
      </div>
    );
    
    if (Number(p.pType) === 1 && isExpired && isSender && p.status !== 4 && p.status !== 3 && p.status !== 2) return <button onClick={() => executeAction('reclaim', p.id)} className="w-full sm:w-auto px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl flex justify-center items-center gap-2 shadow-lg animate-pulse-slow mt-2 whitespace-nowrap"><Undo2 size={14}/> Reclaim Funds</button>;
    
    if (p.status === 0 && isReceiver && (!isExpired || Number(p.pType) !== 1)) return (
      <div className="flex flex-wrap sm:flex-nowrap gap-2 mt-2 w-full sm:w-auto">
        <button onClick={() => setDeclineAction(p)} className="flex-1 sm:flex-none px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-bold rounded-xl whitespace-nowrap">Decline</button>
        {Number(p.pType) === 1 ? (!isCoolingOff && <button onClick={() => executeAction('claim', p.id, p.pType)} className="flex-1 sm:flex-none px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md whitespace-nowrap">Claim</button>)
        : <button onClick={() => executeAction('accept', p.id, p.pType, p.bondAmount)} className="flex-1 sm:flex-none px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md whitespace-nowrap">{Number(p.pType) === 3 ? 'Post Bond' : 'Accept'}</button>}
      </div>
    );
    
    if (p.status === 1 && (!isExpired || Number(p.pType) !== 1)) {
      if (isSender) return (
        <div className="flex flex-wrap sm:flex-nowrap gap-2 mt-2 w-full sm:w-auto">
          <button onClick={() => executeAction('release', p.id)} className="flex-1 sm:flex-none px-3 py-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 text-xs font-bold rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-500/20 whitespace-nowrap">Release</button>
          <button onClick={() => setDisputeAction(p)} className="flex-1 sm:flex-none px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-xl hover:bg-rose-50 dark:hover:bg-rose-500/10 whitespace-nowrap">Dispute</button>
        </div>
      );
      if (isReceiver && Number(p.pType) !== 3) return <button onClick={() => setDisputeAction(p)} className="w-full sm:w-auto px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-xl hover:bg-rose-50 dark:hover:bg-rose-500/10 mt-2 whitespace-nowrap">Dispute</button>;
    }
    return null;
  };

  const filteredPayments = payments.filter(p => {
    if (filter === 'active') return !p.isDeclined && (p.status === 0 || p.status === 1 || p.status === 2);
    if (filter === 'completed') return p.isDeclined || p.status === 3 || p.status === 4;
    return true;
  });

  if (isLoading) return <div className="w-full flex justify-center py-12"><Loader2 className="animate-spin text-indigo-600 dark:text-indigo-400" /></div>;

  return (
    <div className={`w-full space-y-5 ${className} animate-fade-in`}>
      <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1">
        {(['all', 'active', 'completed'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all whitespace-nowrap ${filter === f ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>{f}</button>
        ))}
      </div>
      <div className="space-y-4">
        {filteredPayments.map(p => {
          const isSender = address?.toLowerCase() === p.sender.toLowerCase();
          const isReceiver = address?.toLowerCase() === p.receiver.toLowerCase();
          const isArbiter = address?.toLowerCase() === p.arbiter.toLowerCase();
          
          const isStrictlyArbiter = isArbiter && !isSender && !isReceiver;

          const { text: statusText, color: statusColor, icon: StatusIcon } = getStatusDisplay(p, isSender, isReceiver, isStrictlyArbiter);
          const isExpired = Number(p.pType) === 1 && now > Number(p.deadline) && Number(p.deadline) !== 0;
          const timeLeftString = formatTimeRemaining(Number(p.deadline));
          
          let showWarning = false;
          let warningText = "";
          let warningIconColor = "text-indigo-500 dark:text-indigo-400";

          if (!isStrictlyArbiter && Number(p.pType) === 1 && p.deadline !== "0" && !p.isDeclined && p.status !== 3 && p.status !== 4 && p.status !== 2) {
              if (isExpired && isSender && (p.status === 0 || p.status === 1)) {
                  showWarning = true;
                  warningText = "Deadline Passed: The receiver did not act in time. You may now reclaim your funds.";
                  warningIconColor = "text-amber-500 dark:text-amber-400";
              } else if (!isExpired && (p.status === 0 || p.status === 1)) {
                  showWarning = true;
                  const isCoolingOff = now < Number(p.availableAt);
                  if (isReceiver && isCoolingOff) {
                      warningText = `Cooling Off: This payment unlocks in ${formatTimeRemaining(Number(p.availableAt))}.`;
                  } else if (isReceiver) {
                      warningText = `Action Required: This payment expires in ${timeLeftString}. Ensure you claim the funds before the deadline, or the sender can reclaim them.`;
                  } else {
                      warningText = `Deadline Policy: If the receiver does not claim the funds within ${timeLeftString}, you will be able to reclaim them back to your wallet.`;
                  }
                  warningIconColor = "text-indigo-500 dark:text-indigo-400";
              }
          }

          let destAddress = p.receiver; let destLabel = 'To'; let FlowIcon = ArrowRight; let flowColor = 'text-slate-300 dark:text-slate-600'; let destLabelColor = 'text-slate-500 dark:text-slate-400';
          const isSlashed = Number(p.pType) === 3 && p.status === 3 && p.resolvedTo === "0x0000000000000000000000000000000000000000";
          const isReturned = p.isDeclined || p.status === 4 || (p.status === 3 && verdictPayments.has(String(p.id)) && p.resolvedTo?.toLowerCase() === p.sender.toLowerCase());

          if (isSlashed) { destAddress = '0x0000...0000'; destLabel = 'Slashed'; flowColor = 'text-rose-300 dark:text-rose-500/50'; destLabelColor = 'text-rose-500 dark:text-rose-400'; }
          else if (isReturned) { destAddress = p.sender; destLabel = 'Refunded To'; FlowIcon = Undo2; flowColor = 'text-amber-400 dark:text-amber-500/50'; destLabelColor = 'text-amber-600 dark:text-amber-400'; }

          const hasChatHistory = verdictPayments.has(String(p.id));

          return (
            <div key={p.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col shadow-sm dark:shadow-[0_8px_30px_rgba(0,0,0,0.4)] overflow-hidden">
              <div className="p-4 sm:p-5 flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="space-y-3 w-full sm:w-auto">
                    <div className={`px-2.5 py-1 w-fit rounded-md border text-[10px] font-bold uppercase flex items-center gap-1.5 ${statusColor}`}><StatusIcon size={12} /> {statusText}</div>
                    
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-1.5 whitespace-nowrap"><span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase font-sans">From</span><span className={isSender ? 'text-indigo-600 dark:text-indigo-400 font-bold' : ''}>{truncateAddress(p.sender)}</span></div>
                      <FlowIcon size={12} className={`shrink-0 ${flowColor}`} />
                      <div className="flex items-center gap-1.5 whitespace-nowrap"><span className={`text-[9px] font-bold uppercase font-sans ${destLabelColor}`}>{destLabel}</span><span className={address?.toLowerCase() === destAddress.toLowerCase() ? 'text-indigo-600 dark:text-indigo-400 font-bold' : ''}>{destAddress === '0x0000...0000' ? destAddress : truncateAddress(destAddress)}</span></div>
                      {Number(p.pType) === 2 && <><span className="text-slate-300 dark:text-slate-700 hidden sm:inline shrink-0">•</span><div className="flex items-center gap-1.5 mt-1 sm:mt-0 whitespace-nowrap"><span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase font-sans">Arbiter</span><span className={isArbiter ? 'text-amber-600 dark:text-amber-400 font-bold' : ''}>{truncateAddress(p.arbiter)}</span></div></>}
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-col items-start sm:items-end justify-between w-full sm:w-auto gap-3 pt-2 sm:pt-0">
                    <div className="text-left sm:text-right flex flex-col items-start sm:items-end w-full sm:w-auto border-t border-slate-100 dark:border-slate-800/50 sm:border-0 pt-3 sm:pt-0">
                      <div className="font-bold text-slate-900 dark:text-white text-base">{(Number(p.amount) / 1e6).toFixed(2)} USDC</div>
                      {Number(p.pType) === 3 && <div className="text-[10px] text-slate-600 dark:text-slate-400 font-semibold uppercase mt-0.5">Bond: {(Number(p.bondAmount) / 1e6).toFixed(2)}</div>}
                      
                      {p.lastTxHash && (
                        <div className="flex items-center gap-1.5 mt-1.5 opacity-80 hover:opacity-100 transition-opacity">
                          <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Txn Hash</span>
                          <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-100 dark:border-slate-700">
                            <a href={`https://testnet.arcscan.app/tx/${p.lastTxHash}`} target="_blank" rel="noopener noreferrer" className="font-mono font-medium text-[9px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
                              {truncateAddress(p.lastTxHash)} <ExternalLink size={8} />
                            </a>
                            <div className="w-px h-3 bg-slate-200 dark:bg-slate-700 mx-0.5"></div>
                            <button onClick={() => handleCopyHash(p.lastTxHash as string)} className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" title="Copy Hash">
                              {copiedHash === p.lastTxHash ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} />}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap w-full sm:w-auto gap-2">
                      {getActionButtons(p, isSender, isReceiver, isArbiter)}
                      {Number(p.pType) === 2 && p.status === 2 && <button onClick={() => setActiveChatPayment(p)} className="w-full sm:w-auto justify-center px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-bold rounded-xl shadow-md flex items-center gap-1.5 mt-2"><MessageSquare size={14} /> View Chat</button>}
                      {hasChatHistory && (p.status === 3 || p.status === 4) && <button onClick={() => setActiveChatPayment(p)} className="w-full sm:w-auto justify-center px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 mt-2"><MessageSquare size={14} /> Transcript</button>}
                    </div>
                  </div>
                </div>
                {showWarning && (
                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 mt-1">
                    <Info size={14} className={`${warningIconColor} mt-0.5 shrink-0`} />
                    <p className="text-[10px] sm:text-[11px] font-medium text-slate-600 dark:text-slate-400 leading-normal">
                      {warningText}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {disputeAction && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-fade-in" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl max-w-sm w-full space-y-5 shadow-2xl ring-1 ring-black/5 dark:ring-white/5 max-h-[90vh] overflow-y-auto">
            <div className="text-center space-y-3">
              <div className={`w-12 h-12 border rounded-full mx-auto flex items-center justify-center ${disputeAction.pType === 3 ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-100 dark:border-rose-500/20 text-rose-500 dark:text-rose-400' : 'bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20 text-amber-500 dark:text-amber-400'}`}>
                {disputeAction.pType === 3 ? <Flame className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{disputeAction.pType === 3 ? 'Slash & Burn Funds' : 'Initiate Arbitration'}</h2>
              <div className={`p-4 rounded-2xl border ${disputeAction.pType === 3 ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800'}`}>
                <p className={`text-sm leading-relaxed text-center font-medium ${disputeAction.pType === 3 ? 'text-rose-800 dark:text-rose-300' : 'text-slate-800 dark:text-slate-300'}`}>
                  {disputeAction.pType === 3 ? "Warning: Disputing a Bonded payment will instantly slash the receiver's bond and burn the locked funds. This action is irreversible." : "Warning: Disputing this payment will lock the funds and initiate the arbitration process. The assigned Arbiter will review the case."}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDisputeAction(null)} className="flex-1 py-3 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-300 rounded-xl font-bold text-xs uppercase tracking-wide">Cancel</button>
              <button onClick={() => { executeAction(disputeAction.pType === 3 ? 'slash' : 'dispute', disputeAction.id, disputeAction.pType); setDisputeAction(null); }} className={`flex-1 py-3 text-white rounded-xl font-bold text-xs uppercase tracking-wide ${disputeAction.pType === 3 ? 'bg-rose-600 hover:bg-rose-700' : 'bg-amber-600 hover:bg-amber-700'}`}>
                {disputeAction.pType === 3 ? 'Slash Funds' : 'Start Dispute'}
              </button>
            </div>
          </div>
        </div>, document.body
      )}

      {declineAction && createPortal(
  <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-fade-in" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl max-w-sm w-full space-y-5 shadow-2xl ring-1 ring-black/5 dark:ring-white/5 max-h-[90vh] overflow-y-auto">
      <div className="text-center space-y-3">
        <div className="w-12 h-12 bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400 border border-rose-100 dark:border-rose-500/20 rounded-full mx-auto flex items-center justify-center"><XCircle className="w-6 h-6" /></div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Decline Offer</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Are you sure you want to decline? Funds will return to the sender immediately.</p>
      </div>
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-700 dark:text-slate-400 uppercase tracking-wider text-center block">
          Type <span className="text-slate-900 dark:text-slate-100">DECLINE</span> to confirm
        </label>
        <input
          autoFocus
          type="text"
          placeholder="DECLINE"
          value={declineConfirmText}
          onChange={(e) => setDeclineConfirmText(e.target.value.toUpperCase())}
          className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-3.5 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 font-mono text-base font-bold text-center uppercase focus:outline-none focus:border-rose-500"
        />
      </div>
      <div className="flex gap-2">
        <button onClick={() => { setDeclineAction(null); setDeclineConfirmText(''); }} className="flex-1 py-3 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-300 rounded-xl font-bold text-xs uppercase tracking-wide">Cancel</button>
        <button
          onClick={() => { handleDecline(declineAction.id); setDeclineConfirmText(''); }}
          disabled={declineConfirmText !== 'DECLINE'}
          className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs uppercase tracking-wide disabled:opacity-50"
        >
          Decline
        </button>
      </div>
    </div>
  </div>, document.body
)}

      {resolveAction && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-fade-in" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl max-w-sm w-full space-y-5 shadow-2xl ring-1 ring-black/5 dark:ring-white/5 max-h-[90vh] overflow-y-auto">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center border ${resolveAction.action === 'resolve_sender' ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-100 dark:border-rose-500/20 text-rose-500 dark:text-rose-400' : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20 text-emerald-500 dark:text-emerald-400'}`}><AlertTriangle className="w-6 h-6" /></div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Confirm Verdict</h2>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
              <p className="text-slate-800 dark:text-slate-300 text-sm leading-relaxed text-center font-medium">You are about to irreversibly disburse funds to the <strong className="text-slate-900 dark:text-slate-100">{resolveAction.label}</strong>.</p>
              <div className="bg-slate-200 dark:bg-slate-800 p-3 rounded-xl text-xs text-center font-mono text-slate-900 dark:text-slate-100 font-bold border border-slate-300 dark:border-slate-700">{resolveAction.target}</div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-400 uppercase tracking-wider text-center block">Type <span className="text-slate-900 dark:text-slate-100">CONFIRM</span> to execute</label>
              <input autoFocus type="text" placeholder="CONFIRM" value={resolveConfirmText} onChange={(e) => setResolveConfirmText(e.target.value.toUpperCase())} className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-3.5 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 font-mono text-base font-bold text-center uppercase focus:outline-none focus:border-indigo-500" />
            </div>
            <div className="flex flex-wrap sm:flex-nowrap gap-2">
              <button onClick={() => setResolveAction(null)} className="flex-1 py-3.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-300 rounded-xl font-bold text-sm uppercase tracking-wide">Cancel</button>
              <button onClick={() => { executeAction(resolveAction.action, resolveAction.id, resolveAction.pType, undefined, resolveAction.target); setResolveAction(null); }} disabled={resolveConfirmText !== 'CONFIRM'} className={`flex-1 py-3.5 text-white rounded-xl font-bold text-sm uppercase tracking-wide disabled:opacity-50 ${resolveConfirmText === 'CONFIRM' ? (resolveAction.action === 'resolve_sender' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700') : 'bg-slate-200 dark:bg-slate-800'}`}>Execute</button>
            </div>
          </div>
        </div>, document.body
      )}

      {activeChatPayment && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 bg-black/60 dark:bg-black/80 backdrop-blur-sm" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
          <div className="bg-white dark:bg-slate-900 max-w-lg w-full rounded-3xl overflow-hidden relative ring-1 ring-black/5 dark:ring-white/5">
            <button onClick={() => setActiveChatPayment(null)} className="absolute top-4 right-4 z-50 p-2 bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-full hover:bg-slate-200 dark:hover:bg-slate-700"><X size={16} strokeWidth={3} /></button>
            <ArbiterChat paymentId={activeChatPayment.id} currentUserAddress={address as string} arbiterAddress={activeChatPayment.arbiter} senderAddress={activeChatPayment.sender} receiverAddress={activeChatPayment.receiver} paymentStatus={activeChatPayment.status} />
          </div>
        </div>, document.body
      )}
    </div>
  );
}