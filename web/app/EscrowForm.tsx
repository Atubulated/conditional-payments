'use client';

import React, { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { Shield, User, Clock, DollarSign, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from './constants';
import { useToast } from './Toast';

export default function EscrowForm() {
  const { isConnected } = useAccount();
  const { showToast } = useToast();
  const [paymentMode, setPaymentMode] = useState<'Mediated' | 'Bonded' | 'Timelock'>('Mediated');
  
  // Contract Hooks
  const { data: hash, isPending, writeContract, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  // Form State
  const [receiver, setReceiver] = useState('');
  const [arbiter, setArbiter] = useState('');
  const [amount, setAmount] = useState('');
  
  // Timelock State
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

  // Show toast on transaction confirmed
  useEffect(() => {
    if (isConfirmed && hash) {
      showToast('success', `Escrow created successfully!`);
    }
  }, [isConfirmed, hash, showToast]);

  // Show toast on error
  useEffect(() => {
    if (error) {
      showToast('error', 'Transaction failed. Please try again.');
    }
  }, [error, showToast]);

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

    showToast('info', 'Please confirm the transaction in your wallet');

    const fn = paymentMode === 'Mediated' ? 'createMediatedPayment' : paymentMode === 'Bonded' ? 'createBondedPayment' : 'createTimelockedPayment';
    
    // Hardcoded token/salt/extraData based on your previous script
    const mockToken = '0x2Cff5f1Bc50F990499A90B543A0f51Ae974c0E6c'; 
    const zeroBytes = '0x0000000000000000000000000000000000000000000000000000000000000000';
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400); // 24h default deadline

    const args = paymentMode === 'Mediated' 
      ? [receiver, arbiter, mockToken, parseUnits(amount, 6), zeroBytes, deadline]
      : [receiver, mockToken, parseUnits(amount, 6), BigInt(extraValue), zeroBytes, deadline];

    writeContract({ 
        address: CONTRACT_ADDRESS as `0x${string}`, 
        abi: CONTRACT_ABI, 
        functionName: fn as any, 
        args: args as any 
    });
  };

  // If not connected, we return null (or you could return a "Connect Wallet" placeholder)
  if (!isConnected) return (
    <div className="text-center py-10 text-slate-500 text-sm">
        <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
        Please connect your wallet to access the portal.
    </div>
  );

  return (
    <div className="w-full space-y-6 animate-in fade-in zoom-in-95 duration-500">
      
      {/* 1. Mode Selection Tabs */}
      <div className="bg-slate-950/80 p-1.5 rounded-xl border border-slate-800 flex relative">
        {(['Mediated', 'Bonded', 'Timelock'] as const).map((m) => (
          <button 
            key={m} 
            onClick={() => setPaymentMode(m)} 
            className={`flex-1 py-2.5 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all duration-300 relative z-10 
              ${paymentMode === m ? 'text-white shadow-lg' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
          >
            {m}
            {paymentMode === m && (
                <div className="absolute inset-0 bg-indigo-600 rounded-lg -z-10 shadow-[0_0_15px_-3px_rgba(79,70,229,0.5)]" />
            )}
          </button>
        ))}
      </div>

      {/* 2. Form Inputs */}
      <div className="space-y-5">
        
        {/* Receiver Input */}
        <div className="space-y-1.5 group">
          <label className="text-[10px] uppercase font-bold text-slate-400 ml-1 flex items-center gap-1">
            <User size={12} className="text-indigo-400" /> Receiver Address
          </label>
          <div className="relative">
             <input 
                placeholder="0x..." 
                className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-indigo-500/50 p-3.5 pl-4 rounded-xl text-slate-200 text-sm outline-none transition-all shadow-inner font-mono" 
                onChange={(e) => setReceiver(e.target.value)} 
             />
             <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {receiver.length > 0 && receiver.startsWith('0x') && <CheckCircle2 size={16} className="text-emerald-500" />}
             </div>
          </div>
        </div>

        {/* Arbiter Input (Only for Mediated) */}
        {paymentMode === 'Mediated' && (
          <div className="space-y-1.5 animate-in slide-in-from-top-2">
            <label className="text-[10px] uppercase font-bold text-slate-400 ml-1 flex items-center gap-1">
                <Shield size={12} className="text-indigo-400" /> Arbiter Address
            </label>
            <input 
                placeholder="0x..." 
                className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-indigo-500/50 p-3.5 pl-4 rounded-xl text-slate-200 text-sm outline-none transition-all shadow-inner font-mono" 
                onChange={(e) => setArbiter(e.target.value)} 
            />
          </div>
        )}

        {/* Timelock Inputs (Only for Timelock) */}
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
                        onChange={(e) => item.fn(e.target.value)} 
                        className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500/50 p-3 rounded-xl text-center text-slate-200 text-sm outline-none transition-all font-mono" 
                    />
                    <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-slate-600 uppercase font-bold tracking-wider">{item.label}</span>
                </div>
                ))}
            </div>
            <div className="h-4"></div> {/* Spacer for labels */}
          </div>
        )}

        {/* Amount Input */}
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase font-bold text-slate-400 ml-1 flex items-center gap-1">
            <DollarSign size={12} className="text-indigo-400" /> Amount
          </label>
          <div className="relative">
             <input 
                placeholder="0.00" 
                type="number" 
                className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-indigo-500/50 p-3.5 pl-4 pr-16 rounded-xl text-slate-200 text-lg outline-none transition-all shadow-inner font-mono" 
                onChange={(e) => setAmount(e.target.value)} 
             />
             <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold bg-slate-900 px-2 py-1 rounded border border-slate-800">
                USDC
             </div>
          </div>
        </div>

        {/* Action Button */}
        <button 
            onClick={handleCreate} 
            disabled={isPending || isConfirming || !amount || !receiver}
            className={`
                w-full py-4 rounded-xl font-bold uppercase text-xs tracking-widest transition-all shadow-lg
                flex items-center justify-center gap-2
                ${isPending || isConfirming 
                    ? 'bg-slate-800 text-slate-400 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-indigo-500/20 hover:shadow-indigo-500/40 transform hover:-translate-y-0.5'}
            `}
        >
          {isPending || isConfirming ? (
             <>
               <Loader2 className="animate-spin" size={16} /> 
               {isConfirming ? 'Confirming on Chain...' : 'Check Wallet...'}
             </>
          ) : (
             `Create ${paymentMode} Escrow`
          )}
        </button>

        {/* Transaction Success Message */}
        {isConfirmed && (
            <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center gap-3 text-emerald-400 text-xs">
                <CheckCircle2 size={16} />
                <span>Transaction Confirmed! Hash: <span className="font-mono text-emerald-300">{hash?.slice(0, 6)}...{hash?.slice(-4)}</span></span>
            </div>
        )}

      </div>
    </div>
  );
}