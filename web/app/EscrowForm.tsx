'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { parseUnits } from 'viem';
import { Shield, User, Clock, DollarSign, Loader2, CheckCircle2, AlertCircle, ExternalLink, XCircle } from 'lucide-react';
import { CONTRACT_ADDRESS, CONTRACT_ABI, USDC_ADDRESS } from './constants';
import { useToast } from './Toast';

const ARC_RPC = 'https://rpc.testnet.arc.network';

type TxStatus = 'idle' | 'pending' | 'submitted' | 'confirmed' | 'failed';

// Direct RPC call to get transaction receipt - bypasses all wagmi/viem issues
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
      // status: "0x1" = success, "0x0" = failed
      const status = data.result.status === '0x1' ? 'success' : 'failed';
      return { status };
    }
    
    return null; // Receipt not yet available
  } catch (err) {
    console.error('RPC error:', err);
    return null;
  }
}

export default function EscrowForm() {
  const { isConnected } = useAccount();
  const { showToast } = useToast();
  const [paymentMode, setPaymentMode] = useState<'Mediated' | 'Bonded' | 'Timelock'>('Mediated');
  
  const { data: hash, isPending, writeContract, error, reset } = useWriteContract();

  const [txStatus, setTxStatus] = useState<TxStatus>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

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

  // When hash is received from writeContract, start polling
  useEffect(() => {
    if (hash && txStatus === 'pending') {
      setTxHash(hash);
      setTxStatus('submitted');
    }
  }, [hash, txStatus]);

  // Poll for receipt using direct RPC
  useEffect(() => {
    if (txStatus !== 'submitted' || !txHash) return;

    let isCancelled = false;

    const poll = async () => {
      const receipt = await getReceiptDirect(txHash);
      
      if (isCancelled) return;

      if (receipt) {
        // Clear any pending polling
        if (pollingRef.current) {
          clearTimeout(pollingRef.current);
          pollingRef.current = null;
        }

        if (receipt.status === 'success') {
          setTxStatus('confirmed');
          showToast('success', 'Escrow created successfully!');
        } else {
          setTxStatus('failed');
          showToast('error', 'Transaction failed on chain.');
        }
      } else {
        // Not yet mined, poll again in 1.5 seconds
        pollingRef.current = setTimeout(poll, 1500);
      }
    };

    // Start polling immediately
    poll();

    return () => {
      isCancelled = true;
      if (pollingRef.current) {
        clearTimeout(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [txStatus, txHash, showToast]);

  // Handle wallet rejection or error
  useEffect(() => {
    if (error) {
      setTxStatus('idle');
      showToast('error', 'Transaction rejected.');
    }
  }, [error, showToast]);

  // Set pending when writeContract is called
  useEffect(() => {
    if (isPending && txStatus === 'idle') {
      setTxStatus('pending');
    }
  }, [isPending, txStatus]);

  const handleReset = useCallback(() => {
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

    showToast('info', 'Please confirm in your wallet');

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

        {/* Status-based UI */}
        
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
          <div className="w-full py-4 rounded-xl bg-slate-800 text-slate-300 font-bold uppercase text-xs tracking-widest flex items-center justify-center gap-2">
            <Loader2 className="animate-spin" size={16} /> 
            Confirm in Wallet...
          </div>
        )}

        {txStatus === 'submitted' && txHash && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
            <div className="flex items-center gap-3 mb-3">
              <Loader2 className="animate-spin" size={18} />
              <span className="font-semibold">Confirming on chain...</span>
            </div>
            <a 
              href={`https://testnet.arcscan.app/tx/${txHash}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-sm text-amber-300 hover:text-amber-200 underline"
            >
              View on Explorer <ExternalLink size={14} />
            </a>
          </div>
        )}

        {txStatus === 'confirmed' && txHash && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
            <div className="flex items-center gap-3 mb-3">
              <CheckCircle2 size={18} />
              <span className="font-semibold">Escrow Created Successfully!</span>
            </div>
            <div className="flex items-center justify-between">
              <a 
                href={`https://testnet.arcscan.app/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-sm text-emerald-300 hover:text-emerald-200 underline"
              >
                View on Explorer <ExternalLink size={14} />
              </a>
              <button 
                onClick={handleReset}
                className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 rounded-lg transition-colors text-sm font-semibold"
              >
                Create Another
              </button>
            </div>
          </div>
        )}

        {txStatus === 'failed' && txHash && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
            <div className="flex items-center gap-3 mb-3">
              <XCircle size={18} />
              <span className="font-semibold">Transaction Failed</span>
            </div>
            <div className="flex items-center justify-between">
              <a 
                href={`https://testnet.arcscan.app/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-sm text-red-300 hover:text-red-200 underline"
              >
                View on Explorer <ExternalLink size={14} />
              </a>
              <button 
                onClick={handleReset}
                className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg transition-colors text-sm font-semibold"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}