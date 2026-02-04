'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { parseUnits } from 'viem';
import { Shield, User, Clock, DollarSign, Loader2, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import { CONTRACT_ADDRESS, CONTRACT_ABI, USDC_ADDRESS } from './constants';
import { useToast } from './Toast';

const ARC_RPC = 'https://rpc.testnet.arc.network';

type TxStatus = 'idle' | 'pending' | 'approved' | 'submitted' | 'confirmed' | 'failed' | 'rejected';

async function getReceiptDirect(txHash: string): Promise<{ status: 'success' | 'failed' } | null> {
  try {
    const response = await fetch(ARC_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getTransactionReceipt',
        params: [txHash],
      }),
    });
    
    const data = await response.json();
    
    if (data.result) {
      const status = data.result.status === '0x1' ? 'success' : 'failed';
      return { status };
    }
    
    return null;
  } catch (err) {
    console.error('RPC error:', err);
    return null;
  }
}

interface EscrowFormProps {
  onPaymentCreated?: () => void;
}

export default function EscrowForm({ onPaymentCreated }: EscrowFormProps = {}) {
  const { isConnected } = useAccount();
  const { showToast } = useToast();
  const [paymentMode, setPaymentMode] = useState<'Mediated' | 'Bonded' | 'Timelock'>('Mediated');
  
  const { data: hash, isPending, writeContract, error, reset } = useWriteContract();

  const [txStatus, setTxStatus] = useState<TxStatus>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const approvedTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [receiver, setReceiver] = useState('');
  const [arbiter, setArbiter] = useState('');
  const [amount, setAmount] = useState('');
  
  const [days, setDays] = useState('0');
  const [hours, setHours] = useState('0');
  const [mins, setMins] = useState('0');
  const [extraValue, setExtraValue] = useState('');

  // Calculate total seconds for Timelock
  useEffect(() => {
    if (paymentMode === 'Timelock') {
      const total = (Number(days) * 86400) + (Number(hours) * 3600) + (Number(mins) * 60);
      setExtraValue(total.toString());
    }
  }, [days, hours, mins, paymentMode]);

  // Reset form to initial state
  const resetForm = useCallback(() => {
    reset();
    setTxStatus('idle');
    setTxHash(null);
    setReceiver('');
    setArbiter('');
    setAmount('');
    setDays('0');
    setHours('0');
    setMins('0');
  }, [reset]);

  // When hash is received, show approved then move to submitted
  useEffect(() => {
    if (hash && txStatus === 'pending') {
      setTxHash(hash);
      setTxStatus('approved');
      showToast('info', 'Transaction submitted');
      
      // Clear any existing timeout
      if (approvedTimeoutRef.current) {
        clearTimeout(approvedTimeoutRef.current);
      }
      
      // After 2s, move to submitted state
      approvedTimeoutRef.current = setTimeout(() => {
        setTxStatus('submitted');
      }, 2000);
    }
  }, [hash, txStatus, showToast]);

  // Poll for receipt
  useEffect(() => {
    if (txStatus !== 'submitted' || !txHash) return;

    let isCancelled = false;

    const poll = async () => {
      const receipt = await getReceiptDirect(txHash);
      
      if (isCancelled) return;

      if (receipt) {
        if (pollingRef.current) {
          clearTimeout(pollingRef.current);
          pollingRef.current = null;
        }

        if (receipt.status === 'success') {
          showToast('success', 'Escrow created!', `https://testnet.arcscan.app/tx/${txHash}`, 'View on Explorer');
          // Notify parent to refresh pending payments
          if (onPaymentCreated) {
            onPaymentCreated();
          }
        } else {
          showToast('error', 'Transaction failed', `https://testnet.arcscan.app/tx/${txHash}`, 'View on Explorer');
        }
        
        // Reset form immediately after result
        resetForm();
      } else {
        pollingRef.current = setTimeout(poll, 1500);
      }
    };

    poll();

    return () => {
      isCancelled = true;
      if (pollingRef.current) {
        clearTimeout(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [txStatus, txHash, showToast, resetForm]);

  // Handle wallet rejection
  useEffect(() => {
    if (error) {
      showToast('error', 'Transaction declined');
      resetForm();
    }
  }, [error, showToast, resetForm]);

  // Set pending when writeContract is called
  useEffect(() => {
    if (isPending && txStatus === 'idle') {
      setTxStatus('pending');
    }
  }, [isPending, txStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearTimeout(pollingRef.current);
      if (approvedTimeoutRef.current) clearTimeout(approvedTimeoutRef.current);
    };
  }, []);

  const handleCreate = () => {
    if (!amount || !receiver) {
      showToast('error', 'Please fill in all required fields');
      return;
    }

    if (!receiver.startsWith('0x') || receiver.length !== 42) {
      showToast('error', 'Invalid receiver address');
      return;
    }

    if (paymentMode === 'Mediated' && (!arbiter || !arbiter.startsWith('0x') || arbiter.length !== 42)) {
      showToast('error', 'Invalid arbiter address');
      return;
    }

    const fn = paymentMode === 'Mediated' 
      ? 'createMediatedPayment' 
      : paymentMode === 'Bonded' 
        ? 'createBondedPayment' 
        : 'createTimelockedPayment';
    
    const zeroBytes = '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400);

    const args = paymentMode === 'Mediated' 
      ? [receiver as `0x${string}`, arbiter as `0x${string}`, USDC_ADDRESS as `0x${string}`, parseUnits(amount, 6), zeroBytes, deadline]
      : [receiver as `0x${string}`, USDC_ADDRESS as `0x${string}`, parseUnits(amount, 6), BigInt(extraValue || '0'), zeroBytes, deadline];

    writeContract({ 
      address: CONTRACT_ADDRESS as `0x${string}`, 
      abi: CONTRACT_ABI, 
      functionName: fn as any, 
      args: args as any 
    });
  };

  if (!isConnected) {
    return (
      <div className="text-center py-10 text-slate-500 text-sm">
        <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
        Please connect your wallet to access the portal.
      </div>
    );
  }

  const isFormDisabled = txStatus !== 'idle';

  return (
    <div className="w-full space-y-6 animate-in fade-in zoom-in-95 duration-500">
      
      {/* Mode Selection */}
      <div className="bg-slate-950/80 p-1.5 rounded-xl border border-slate-800 flex">
        {(['Mediated', 'Bonded', 'Timelock'] as const).map((m) => (
          <button 
            key={m} 
            onClick={() => !isFormDisabled && setPaymentMode(m)} 
            disabled={isFormDisabled}
            className={`flex-1 py-2.5 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all duration-300 relative z-10 
              ${paymentMode === m ? 'text-white shadow-lg' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}
              ${isFormDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {m}
            {paymentMode === m && (
              <div className="absolute inset-0 bg-indigo-600 rounded-lg -z-10 shadow-[0_0_15px_-3px_rgba(79,70,229,0.5)]" />
            )}
          </button>
        ))}
      </div>

      {/* Form */}
      <div className="space-y-5">
        
        {/* Receiver */}
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase font-bold text-slate-400 ml-1 flex items-center gap-1">
            <User size={12} className="text-indigo-400" /> Receiver Address
          </label>
          <div className="relative">
            <input 
              placeholder="0x..." 
              value={receiver}
              disabled={isFormDisabled}
              className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-indigo-500/50 p-3.5 pl-4 rounded-xl text-slate-200 text-sm outline-none transition-all shadow-inner font-mono disabled:opacity-50" 
              onChange={(e) => setReceiver(e.target.value)} 
            />
            {receiver.length === 42 && receiver.startsWith('0x') && (
              <CheckCircle2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500" />
            )}
          </div>
        </div>

        {/* Arbiter (Mediated only) */}
        {paymentMode === 'Mediated' && (
          <div className="space-y-1.5 animate-in slide-in-from-top-2">
            <label className="text-[10px] uppercase font-bold text-slate-400 ml-1 flex items-center gap-1">
              <Shield size={12} className="text-indigo-400" /> Arbiter Address
            </label>
            <input 
              placeholder="0x..." 
              value={arbiter}
              disabled={isFormDisabled}
              className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-indigo-500/50 p-3.5 pl-4 rounded-xl text-slate-200 text-sm outline-none transition-all shadow-inner font-mono disabled:opacity-50" 
              onChange={(e) => setArbiter(e.target.value)} 
            />
          </div>
        )}

        {/* Timelock Duration */}
        {paymentMode === 'Timelock' && (
          <div className="space-y-1.5 animate-in slide-in-from-top-2">
            <label className="text-[10px] uppercase font-bold text-slate-400 ml-1 flex items-center gap-1">
              <Clock size={12} className="text-indigo-400" /> Unlock Duration
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Days', fn: setDays, val: days }, 
                { label: 'Hours', fn: setHours, val: hours }, 
                { label: 'Mins', fn: setMins, val: mins }
              ].map((item) => (
                <div key={item.label} className="relative">
                  <input 
                    type="number" 
                    value={item.val} 
                    disabled={isFormDisabled}
                    onChange={(e) => item.fn(e.target.value)} 
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500/50 p-3 rounded-xl text-center text-slate-200 text-sm outline-none transition-all font-mono disabled:opacity-50" 
                  />
                  <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-slate-600 uppercase font-bold tracking-wider">{item.label}</span>
                </div>
              ))}
            </div>
            <div className="h-4" />
          </div>
        )}

        {/* Amount */}
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase font-bold text-slate-400 ml-1 flex items-center gap-1">
            <DollarSign size={12} className="text-indigo-400" /> Amount
          </label>
          <div className="relative">
            <input 
              placeholder="0.00" 
              type="number"
              value={amount}
              disabled={isFormDisabled}
              className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-indigo-500/50 p-3.5 pl-4 pr-16 rounded-xl text-slate-200 text-lg outline-none transition-all shadow-inner font-mono disabled:opacity-50" 
              onChange={(e) => setAmount(e.target.value)} 
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold bg-slate-900 px-2 py-1 rounded border border-slate-800">
              USDC
            </div>
          </div>
        </div>

        {/* Status-based Button/Indicator */}
        
        {txStatus === 'idle' && (
          <button 
            onClick={handleCreate} 
            disabled={!amount || !receiver}
            className={`w-full py-4 rounded-xl font-bold uppercase text-xs tracking-widest transition-all shadow-lg flex items-center justify-center gap-2
              ${!amount || !receiver 
                ? 'bg-slate-800 text-slate-400 cursor-not-allowed' 
                : 'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-indigo-500/20 hover:shadow-indigo-500/40 transform hover:-translate-y-0.5'}`}
          >
            Create {paymentMode} Escrow
          </button>
        )}

        {txStatus === 'pending' && (
          <div className="w-full py-4 rounded-xl bg-slate-800/80 border border-slate-700/50 text-slate-300 font-medium text-sm flex items-center justify-center gap-3">
            <Loader2 className="animate-spin text-indigo-400" size={18} /> 
            Confirm in Wallet...
          </div>
        )}

        {txStatus === 'approved' && (
          <div className="w-full py-4 rounded-xl bg-slate-800/80 border border-cyan-500/30 text-cyan-300 font-medium text-sm flex items-center justify-center gap-3 animate-pulse">
            <CheckCircle2 className="text-cyan-400" size={18} /> 
            Transaction Approved
          </div>
        )}

        {txStatus === 'submitted' && (
          <div className="w-full py-4 rounded-xl bg-slate-800/80 border border-indigo-500/30 text-indigo-300 font-medium text-sm flex items-center justify-center gap-3">
            <Loader2 className="animate-spin text-indigo-400" size={18} /> 
            Confirming on chain...
          </div>
        )}

      </div>
    </div>
  );
}