'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { parseUnits, formatUnits, maxUint256 } from 'viem';
import { Shield, User, Clock, DollarSign, Loader2, CheckCircle2, AlertCircle, Snowflake, ClipboardPaste, AlertTriangle } from 'lucide-react';
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

type TxStatus = 'idle' | 'pending' | 'approved' | 'submitted' | 'confirmed' | 'failed' | 'rejected';

export default function EscrowForm({ onPaymentCreated }: { onPaymentCreated?: () => void }) {
  // THE FIX: We drop isConnected and strictly check for the address.
  const { address } = useAccount();
  const hasWallet = !!address;
  
  const { showToast } = useToast();
  const [paymentMode, setPaymentMode] = useState<'Mediated' | 'Bonded' | 'Timelock'>('Timelock'); 

  const { data: hash, isPending, writeContract, error, reset } = useWriteContract();

  const [txStatus, setTxStatus] = useState<TxStatus>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const approvedTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [receiver, setReceiver] = useState('');
  const [arbiter, setArbiter] = useState('');
  const [amount, setAmount] = useState('');
  const [extraValue, setExtraValue] = useState(''); 

  const [actionType, setActionType] = useState<'approve' | 'create'>('create');
  const [localApprovalSuccess, setLocalApprovalSuccess] = useState(false);

  const { data: balanceData } = useReadContract({
    address: USDC_ADDRESS, abi: ERC20_ABI, functionName: 'balanceOf', args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 2000 }
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: USDC_ADDRESS, abi: ERC20_ABI, functionName: 'allowance', args: address ? [address, CONTRACT_ADDRESS] : undefined,
    query: { enabled: !!address, refetchInterval: 2000 }
  });

  const [deadlineHours, setDeadlineHours] = useState('');
  const [coolOffHours, setCoolOffHours] = useState('');
  const [coolOffMins, setCoolOffMins] = useState('');

  const resetForm = useCallback(() => {
    reset(); setTxStatus('idle'); setTxHash(null);
    setReceiver(''); setArbiter(''); setAmount(''); setExtraValue('');
    setDeadlineHours(''); setCoolOffHours(''); setCoolOffMins('');
    setLocalApprovalSuccess(false);
  }, [reset]);

  const handlePaste = async (setter: React.Dispatch<React.SetStateAction<string>>) => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setter(text.trim());
    } catch (err) { showToast('error', 'Clipboard access denied'); }
  };

  const formattedBalance = balanceData ? formatUnits(balanceData as bigint, 6) : '0.00';
  const handleMaxBalance = () => setAmount(formattedBalance);

  useEffect(() => {
    if (hash && txStatus === 'pending') {
      setTxHash(hash); setTxStatus('approved');
      showToast('info', actionType === 'approve' ? 'Approval submitted' : 'Transaction submitted');
      if (approvedTimeoutRef.current) clearTimeout(approvedTimeoutRef.current);
      approvedTimeoutRef.current = setTimeout(() => setTxStatus('submitted'), 2000);
    }
  }, [hash, txStatus, showToast, actionType]);

  useEffect(() => {
    if (txStatus !== 'submitted' || !txHash) return;
    let isCancelled = false;
    const poll = async () => {
      const receipt = await getReceiptDirect(txHash);
      if (isCancelled) return;
      if (receipt) {
        if (pollingRef.current) clearTimeout(pollingRef.current);
        if (receipt.status === 'success') {
          if (actionType === 'approve') {
            showToast('success', 'USDC Approved!', `https://testnet.arcscan.app/tx/${txHash}`, 'View Explorer');
            setLocalApprovalSuccess(true); refetchAllowance();
          } else {
            showToast('success', 'Escrow created!', `https://testnet.arcscan.app/tx/${txHash}`, 'View Explorer');
            if (onPaymentCreated) onPaymentCreated();
            resetForm();
          }
        } else { 
            showToast('error', 'Transaction failed', `https://testnet.arcscan.app/tx/${txHash}`, 'View Explorer'); 
            resetForm();
        }
        if (actionType === 'approve' && receipt.status === 'success') { reset(); setTxStatus('idle'); setTxHash(null); } 
      } else { pollingRef.current = setTimeout(poll, 1500); }
    };
    poll();
    return () => { isCancelled = true; if (pollingRef.current) clearTimeout(pollingRef.current); };
  }, [txStatus, txHash, showToast, resetForm, onPaymentCreated, actionType, reset, refetchAllowance]);

  useEffect(() => { if (error) { showToast('error', 'Transaction declined'); resetForm(); } }, [error, showToast, resetForm]);
  useEffect(() => { if (isPending && txStatus === 'idle') setTxStatus('pending'); }, [isPending, txStatus]);

  const handleAction = () => {
    const amountBigInt = parseUnits(amount, 6);
    const currentAllowance = allowance ? (allowance as bigint) : BigInt(0);

    if (!localApprovalSuccess && currentAllowance < amountBigInt) {
      setActionType('approve');
      writeContract({ address: USDC_ADDRESS, abi: ERC20_ABI, functionName: 'approve', args: [CONTRACT_ADDRESS, maxUint256] });
      return;
    }

    setActionType('create');
    const fn = paymentMode === 'Mediated' ? 'createMediatedPayment' : paymentMode === 'Bonded' ? 'createBondedPayment' : 'createTimelockedPayment';
    const zeroBytes = '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`;
    const now = Math.floor(Date.now() / 1000);
    
    let args: any[];
    if (paymentMode === 'Mediated') {
      const deadline = BigInt(now + 86400); 
      args = [receiver as `0x${string}`, arbiter as `0x${string}`, USDC_ADDRESS as `0x${string}`, amountBigInt, zeroBytes, deadline];
    } else if (paymentMode === 'Timelock') {
      const delaySeconds = (Number(coolOffHours || 0) * 3600) + (Number(coolOffMins || 0) * 60);
      args = [receiver as `0x${string}`, USDC_ADDRESS as `0x${string}`, amountBigInt, BigInt(delaySeconds), zeroBytes, BigInt(now + (Number(deadlineHours || 0) * 3600))];
    } else {
      const deadline = BigInt(now + 86400); 
      const bondAmountBigInt = parseUnits(extraValue || '0', 6);
      args = [receiver as `0x${string}`, USDC_ADDRESS as `0x${string}`, amountBigInt, bondAmountBigInt, zeroBytes, deadline];
    }
    writeContract({ address: CONTRACT_ADDRESS as `0x${string}`, abi: CONTRACT_ABI, functionName: fn as any, args: args as any });
  };

  const isValidAddress = (addr: string) => addr.length === 42 && addr.startsWith('0x');
  const isFormDisabled = txStatus !== 'idle';
  
  const amountBN = amount ? parseUnits(amount, 6) : BigInt(0);
  const bondBN = (paymentMode === 'Bonded' && extraValue) ? parseUnits(extraValue, 6) : BigInt(0);
  const totalRequiredBN = amountBN + bondBN;
  const currentBalanceBN = balanceData ? (balanceData as bigint) : BigInt(0);
  const hasInsufficientBalance = amount !== '' && totalRequiredBN > currentBalanceBN;

  const isFormValid = amount && receiver && isValidAddress(receiver) && !hasInsufficientBalance &&
    (paymentMode !== 'Mediated' || (arbiter && isValidAddress(arbiter))) &&
    (paymentMode !== 'Bonded' || (extraValue && Number(extraValue) > 0)) &&
    (paymentMode !== 'Timelock' || (Number(deadlineHours) > 0));

  const currentAllowance = allowance ? (allowance as bigint) : BigInt(0);
  const needsApproval = (amountBN > BigInt(0) && currentAllowance < totalRequiredBN) && !localApprovalSuccess;

  const buttonText = hasInsufficientBalance ? 'Insufficient USDC' : needsApproval ? 'Approve USDC' : `Create ${paymentMode} Escrow`;

  if (!hasWallet) {
    return (
      <div className="flex flex-col items-center justify-center py-16 animate-fade-in-up">
        <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center mb-4"><AlertCircle className="w-6 h-6 text-slate-400" /></div>
        <p className="text-slate-500 text-sm font-medium">Connect your wallet to access the portal</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-5 animate-fade-in">
      <style dangerouslySetInnerHTML={{__html: `
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type="number"] { -moz-appearance: textfield; }
      `}} />

      {/* COMPACT MAC-STYLE TABS */}
      <div className="p-1 bg-slate-100 rounded-lg flex relative w-full border border-slate-200/60 shadow-inner">
        {(['Mediated', 'Bonded', 'Timelock'] as const).map((mode) => {
          const isActive = paymentMode === mode;
          return (
            <button key={mode} onClick={() => { if(!isFormDisabled) { setPaymentMode(mode); resetForm(); } }} disabled={isFormDisabled} className={`relative z-10 flex-1 py-1.5 text-xs font-bold tracking-wide transition-all duration-200 rounded-md ${isActive ? 'text-slate-900 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)] border border-slate-200' : 'text-slate-500 hover:text-slate-700 border border-transparent'} disabled:opacity-50 disabled:cursor-not-allowed`}>
              {mode}
            </button>
          );
        })}
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5 group">
          <label className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider pl-1">
            <span className="flex items-center gap-1.5"><User size={12} className="text-slate-400" /> Receiver Address</span>
          </label>
          <div className="relative flex items-center">
            {/* TIGHT INPUTS */}
            <input type="text" placeholder="0x..." value={receiver} disabled={isFormDisabled} onChange={(e) => setReceiver(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 pr-10 text-slate-900 placeholder:text-slate-300 font-mono text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all disabled:opacity-50 disabled:bg-slate-50" />
            <div className="absolute right-2 flex items-center gap-1.5">
              {!receiver && <button onClick={() => handlePaste(setReceiver)} className="p-1 text-slate-400 hover:text-indigo-600 transition-colors" title="Paste"><ClipboardPaste size={14} /></button>}
              {isValidAddress(receiver) && <CheckCircle2 size={14} className="text-indigo-600 animate-scale-in" />}
            </div>
          </div>
        </div>

        {paymentMode === 'Mediated' && (
          <div className="space-y-1.5 group animate-fade-in-up">
            <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider pl-1"><Shield size={12} className="text-slate-400" /> Arbiter Address</label>
            <div className="relative flex items-center">
              <input type="text" placeholder="0x..." value={arbiter} disabled={isFormDisabled} onChange={(e) => setArbiter(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 pr-10 text-slate-900 placeholder:text-slate-300 font-mono text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all disabled:opacity-50 disabled:bg-slate-50" />
              <div className="absolute right-2 flex items-center gap-1.5">
                {!arbiter && <button onClick={() => handlePaste(setArbiter)} className="p-1 text-slate-400 hover:text-indigo-600 transition-colors" title="Paste"><ClipboardPaste size={14} /></button>}
                {isValidAddress(arbiter) && <CheckCircle2 size={14} className="text-indigo-600 animate-scale-in" />}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-1.5 group">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider pl-1">
            <label className="flex items-center gap-1.5"><DollarSign size={12} className="text-slate-400" /> Payment Amount</label>
            <div className="flex items-center gap-2">
              <span className="font-mono text-slate-500 text-[10px] normal-case">{formattedBalance} USDC</span>
              <button type="button" onClick={handleMaxBalance} className="text-[9px] font-bold text-slate-600 hover:text-indigo-600 transition-colors cursor-pointer border border-slate-200 bg-slate-50 hover:bg-slate-100 px-1.5 py-0.5 rounded">MAX</button>
            </div>
          </div>
          <div className="relative">
            <input type="number" placeholder="0.00" value={amount} disabled={isFormDisabled} onChange={(e) => setAmount(e.target.value)} className={`w-full bg-white border rounded-lg px-3 py-2.5 pl-3 pr-16 text-slate-900 placeholder:text-slate-300 font-mono text-base font-medium focus:outline-none transition-all disabled:opacity-50 disabled:bg-slate-50 ${hasInsufficientBalance ? 'border-rose-400 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/20' : 'border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20'}`} />
            <div className="absolute right-2 top-1/2 -translate-y-1/2"><span className="text-[9px] font-bold text-slate-500 bg-slate-50 px-2 py-1 rounded border border-slate-200 uppercase select-none">USDC</span></div>
          </div>
        </div>

        {paymentMode === 'Timelock' && (
          <div className="space-y-4 animate-fade-in-up">
            <div className="space-y-1.5 group">
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider pl-1"><Snowflake size={12} className="text-slate-400" /> Cooling-Off Period</label>
              <div className="grid grid-cols-2 gap-3">
                {[ { label: 'Hours', value: coolOffHours, setter: setCoolOffHours, placeholder: '0' }, { label: 'Mins', value: coolOffMins, setter: setCoolOffMins, placeholder: '0' } ].map((item) => (
                  <div key={item.label} className="relative group">
                    <input type="number" min="0" placeholder={item.placeholder} value={item.value} disabled={isFormDisabled} onChange={(e) => item.setter(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg py-2.5 pl-3 pr-12 text-left text-slate-900 placeholder:text-slate-300 font-mono text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all disabled:opacity-50 disabled:bg-slate-50" />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2"><span className="text-[9px] font-bold text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 uppercase select-none">{item.label}</span></div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="space-y-1.5 group">
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider pl-1"><Clock size={12} className="text-slate-400" /> Claim Deadline</label>
              <div className="relative group">
                <input type="number" min="1" placeholder="0" value={deadlineHours} disabled={isFormDisabled} onChange={(e) => setDeadlineHours(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg py-2.5 pl-3 pr-14 text-slate-900 placeholder:text-slate-300 font-mono text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all disabled:opacity-50 disabled:bg-slate-50" />
                <div className="absolute right-2 top-1/2 -translate-y-1/2"><span className="text-[9px] font-bold text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 uppercase select-none">HOURS</span></div>
              </div>
            </div>
          </div>
        )}

        {paymentMode === 'Bonded' && (
          <div className="space-y-1.5 group animate-fade-in-up">
            <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider pl-1"><Shield size={12} className="text-slate-400" /> Bond Required</label>
            <div className="relative">
              <input type="number" placeholder="0.00" value={extraValue} disabled={isFormDisabled} onChange={(e) => setExtraValue(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 pl-3 pr-16 text-slate-900 placeholder:text-slate-300 font-mono text-base focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all disabled:opacity-50 disabled:bg-slate-50" />
              <div className="absolute right-2 top-1/2 -translate-y-1/2"><span className="text-[9px] font-bold text-slate-500 bg-slate-50 px-2 py-1 rounded border border-slate-200 uppercase select-none">USDC</span></div>
            </div>
          </div>
        )}

        <div className="pt-2">
          {/* COMPACT WARNING */}
          {isFormValid && !hasInsufficientBalance && txStatus === 'idle' && (
            <div className="mb-4 p-2.5 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2 animate-fade-in-up">
              <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-amber-800 text-[11px] font-medium leading-snug">
                <strong className="font-bold">Notice:</strong> Your wallet may flag this transaction. This is expected for testnet.
              </p>
            </div>
          )}

          {/* PRECISION SUBMIT BUTTON */}
          {txStatus === 'idle' && (
            <button onClick={handleAction} disabled={!isFormValid || hasInsufficientBalance} className={`w-full py-3 rounded-lg font-bold text-xs uppercase tracking-wide transition-all duration-200 ${isFormValid && !hasInsufficientBalance ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-[0_2px_10px_rgba(79,70,229,0.2)] active:scale-[0.99]' : hasInsufficientBalance ? 'bg-rose-50 text-rose-500 cursor-not-allowed border border-rose-200' : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'}`}>{buttonText}</button>
          )}

          {txStatus !== 'idle' && (
            <div className={`w-full py-3 rounded-lg border flex items-center justify-center gap-2 text-xs font-bold tracking-wide uppercase ${txStatus === 'approved' ? 'border-emerald-200 bg-emerald-50 text-emerald-600' : 'border-indigo-200 bg-indigo-50 text-indigo-600 animate-pulse'}`}>
              {txStatus === 'pending' && <Loader2 className="animate-spin text-indigo-600" size={14} />}
              {txStatus === 'submitted' && <Loader2 className="animate-spin text-indigo-600" size={14} />}
              {txStatus === 'approved' && <CheckCircle2 size={14} />}
              <span>{txStatus === 'pending' ? 'Confirm in Wallet...' : txStatus === 'submitted' ? 'Processing...' : 'Approved!'}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}