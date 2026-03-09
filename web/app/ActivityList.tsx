'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { formatUnits } from 'viem';
// FIXED: Added Loader2 and Snowflake to the import list
import { Shield, Clock, ExternalLink, AlertTriangle, CheckCircle, XCircle, ArrowRight, Banknote, Loader2, Snowflake } from 'lucide-react';
import { CONTRACT_ADDRESS, CONTRACT_ABI, USDC_ADDRESS, ERC20_ABI } from './constants';
import { useToast } from './Toast';

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
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  useEffect(() => {
    const interval = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchPayments = useCallback(async () => {
    if (!address || !isConnected || typeof window === 'undefined' || !window.ethereum) return;
    try {
      setIsLoading(true);
      const { ethers } = await import('ethers');
      const provider = new ethers.BrowserProvider(window.ethereum as any);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI as any, provider);

      const userPayments: any[] = [];
      const currentUser = address.toLowerCase();
      const emptyAddress = '0x0000000000000000000000000000000000000000';

      let currentId = 0;
      const maxChecks = 50; 
      let rpcFailed = false;

      while (currentId < maxChecks) {
        try {
          const p = await contract.getPayment(BigInt(currentId));
          const sender = p[0].toLowerCase();
          const receiver = p[1].toLowerCase();
          const arbiter = p[2].toLowerCase();

          if (sender !== emptyAddress && (sender === currentUser || receiver === currentUser || arbiter === currentUser)) {
            userPayments.push({
              id: currentId.toString(), sender: p[0], receiver: p[1], arbiter: p[2], token: p[3],
              amount: p[4].toString(), bondAmount: p[5].toString(), deadline: p[6].toString(), availableAt: p[7].toString(), acceptedAt: p[8].toString(), termsHash: p[9],
              pType: Number(p[10]), status: Number(p[11]), resolvedTo: p[13]
            });
          }
          currentId++;
        } catch (err: any) {
          if (err.code !== 'CALL_EXCEPTION' && !err.message?.includes('revert')) { rpcFailed = true; }
          break;
        }
      }

      if (!rpcFailed) {
        setPayments(userPayments.sort((a, b) => Number(b.id) - Number(a.id)));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [address, isConnected]);

  useEffect(() => {
    if (isConnected) {
      fetchPayments();
      const interval = setInterval(fetchPayments, 5000);
      return () => clearInterval(interval);
    }
  }, [isConnected, fetchPayments]);

  const truncateAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const formatTimeRemaining = (targetTime: number) => {
    const remaining = targetTime - now;
    if (remaining <= 0) return 'Available';
    const hrs = Math.floor(remaining / 3600);
    const mins = Math.floor((remaining % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m ${remaining % 60}s`;
  };

  const executeAction = async (action: string, id: string, pType?: number, amount?: string) => {
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
        else return;

        // FIXED: Added "as any" to bypass strict TypeScript checking for dynamic function calls
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
            setTimeout(fetchPayments, 1000);
        } else {
            showToast('error', 'Transaction Failed');
        }
    } catch (e) {
        showToast('error', 'Action Cancelled or Failed');
    }
  };

  const getStatusDisplay = (p: any, isSender: boolean, isReceiver: boolean, isArbiter: boolean) => {
    const status = p.status;
    const isDisputed = status === 2;
    const isTimelocked = p.pType === 1;
    const availableAt = Number(p.availableAt);
    const deadline = Number(p.deadline);
    const isCoolingOff = status === 0 && now < availableAt;
    const isExpired = status === 0 && now > deadline;

    if (status === 4) return { text: 'Refunded', color: 'text-rose-600 bg-rose-50 border-rose-200', icon: XCircle };
    if (status === 3) {
      if (p.pType === 3 && p.resolvedTo === "0x0000000000000000000000000000000000000000") {
          return { text: 'Slashed', color: 'text-rose-600 bg-rose-50 border-rose-200', icon: XCircle };
      }
      return { text: 'Completed', color: 'text-emerald-600 bg-emerald-50 border-emerald-200', icon: CheckCircle };
    }
    
    if (isDisputed) return { text: 'In Dispute', color: 'text-amber-600 bg-amber-50 border-amber-200', icon: AlertTriangle };

    if (status === 1) return { text: 'Active', color: 'text-indigo-600 bg-indigo-50 border-indigo-200', icon: Shield };

    if (status === 0) {
      if (isExpired) return { text: 'Expired', color: 'text-slate-600 bg-slate-100 border-slate-200', icon: Clock };
      if (isTimelocked && isCoolingOff) return { text: `Locked: ${formatTimeRemaining(availableAt)}`, color: 'text-indigo-600 bg-indigo-50 border-indigo-200', icon: Snowflake };
      if (isTimelocked && !isCoolingOff) return { text: 'Ready to Claim', color: 'text-emerald-600 bg-emerald-50 border-emerald-200', icon: CheckCircle };
      return { text: 'Awaiting Action', color: 'text-amber-600 bg-amber-50 border-amber-200', icon: Clock };
    }

    return { text: 'Unknown', color: 'text-slate-500 bg-slate-100', icon: Clock };
  };

  const getActionButtons = (p: any, isSender: boolean, isReceiver: boolean, isArbiter: boolean) => {
    if (p.status === 3 || p.status === 4 || p.status === 2) return null;

    const isTimelocked = p.pType === 1;
    const isBonded = p.pType === 3;
    const availableAt = Number(p.availableAt);
    const deadline = Number(p.deadline);
    const isExpired = now > deadline;
    const isCoolingOff = now < availableAt;

    if (p.status === 0) {
        if (isExpired && isSender) return <button onClick={() => executeAction('reclaim', p.id)} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors border border-slate-300 shadow-sm">Reclaim</button>;
        if (isTimelocked && isReceiver && !isCoolingOff && !isExpired) return <button onClick={() => executeAction('claim', p.id)} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm">Claim</button>;
        if (!isTimelocked && isReceiver && !isExpired) return <button onClick={() => executeAction('accept', p.id, p.pType, p.bondAmount)} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm">{isBonded ? 'Post Bond' : 'Accept'}</button>;
    }

    if (p.status === 1) {
        if (isSender) return (
            <div className="flex gap-2">
                <button onClick={() => executeAction('release', p.id)} className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-lg transition-colors shadow-sm">Release</button>
                <button onClick={() => executeAction('dispute', p.id)} className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors shadow-sm">Dispute</button>
            </div>
        );
        if (isReceiver && !isBonded) return <button onClick={() => executeAction('dispute', p.id)} className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors shadow-sm">Dispute</button>;
    }

    return null;
  };

  const filteredPayments = payments.filter(p => {
    if (filter === 'active') return p.status === 0 || p.status === 1 || p.status === 2;
    if (filter === 'completed') return p.status === 3 || p.status === 4;
    return true;
  });

  if (isLoading) {
    return (
      <div className={`w-full flex justify-center py-12 ${className}`}>
        <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className={`w-full flex flex-col items-center justify-center py-16 text-slate-500 bg-white border border-slate-200 rounded-xl shadow-sm ${className}`}>
        <Banknote className="w-10 h-10 mb-3 opacity-50" />
        <p className="text-sm font-semibold">No activity found</p>
      </div>
    );
  }

  return (
    <div className={`w-full space-y-4 ${className} animate-fade-in`}>
      <div className="flex gap-2">
        {(['all', 'active', 'completed'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${filter === f ? 'bg-slate-900 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filteredPayments.map(p => {
          const isSender = address?.toLowerCase() === p.sender.toLowerCase();
          const isReceiver = address?.toLowerCase() === p.receiver.toLowerCase();
          const isArbiter = address?.toLowerCase() === p.arbiter.toLowerCase();
          const { text: statusText, color: statusColor, icon: StatusIcon } = getStatusDisplay(p, isSender, isReceiver, isArbiter);

          return (
            <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center hover:border-indigo-300 transition-colors shadow-sm">
              <div className="space-y-3 w-full sm:w-auto">
                <div className="flex items-center gap-3">
                  <div className={`px-2.5 py-1 rounded-md border text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${statusColor}`}>
                    <StatusIcon size={12} /> {statusText}
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID #{p.id}</span>
                </div>
                
                <div className="flex items-center gap-2 sm:gap-4 text-xs font-mono text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-bold text-slate-400 uppercase font-sans">From</span>
                    <span className={isSender ? 'text-indigo-600 font-bold' : ''}>{truncateAddress(p.sender)}</span>
                  </div>
                  <ArrowRight size={12} className="text-slate-300" />
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-bold text-slate-400 uppercase font-sans">To</span>
                    <span className={isReceiver ? 'text-indigo-600 font-bold' : ''}>{truncateAddress(p.receiver)}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-3 border-t border-slate-100 sm:border-0 pt-3 sm:pt-0">
                <div className="text-right">
                  <div className="font-bold text-slate-900 font-mono text-base">{(Number(p.amount) / 1e6).toFixed(2)} USDC</div>
                  {p.pType === 3 && <div className="text-[10px] text-slate-500 font-semibold uppercase mt-0.5">Bond: {(Number(p.bondAmount) / 1e6).toFixed(2)}</div>}
                </div>
                {getActionButtons(p, isSender, isReceiver, isArbiter)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}