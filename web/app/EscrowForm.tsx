'use client';

import React, { useState, useCallback } from 'react';
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

async function waitForReceiptWithStatus(txHash: string, timeoutMs: number = 60000): Promise<{ status: 'success' | 'failed' }> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    const receipt = await getReceiptDirect(txHash);
    if (receipt) return receipt;
    await new Promise(r => setTimeout(r, 1500));
  }
  throw new Error('Transaction timeout');
}

type TxStatus = 'idle' | 'pending' | 'processing';

export default function EscrowForm({ onPaymentCreated }: { onPaymentCreated?: () => void }) {
  const { address } = useAccount();
  const hasWallet = !!address;
  
  const { showToast } = useToast();
  const [paymentMode, setPaymentMode] = useState<'Mediated' | 'Bonded' | 'Timelock'>('Timelock'); 

  const { writeContractAsync } = useWriteContract();

  const [txStatus, setTxStatus] = useState<TxStatus>('idle');

  const [receiver, setReceiver] = useState('');
  const [arbiter, setArbiter] = useState('');
  const [amount, setAmount] = useState('');
  const [extraValue, setExtraValue] = useState(''); 

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
    setTxStatus('idle');
    setReceiver(''); setArbiter(''); setAmount(''); setExtraValue('');
    setDeadlineHours(''); setCoolOffHours(''); setCoolOffMins('');
    setLocalApprovalSuccess(false);
  }, []);

  const handlePaste = async (setter: React.Dispatch<React.SetStateAction<string>>) => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setter(text.trim());
    } catch (err) { showToast('error', 'Clipboard access denied'); }
  };

  const formattedBalance = balanceData ? formatUnits(balanceData as bigint, 6) : '0.00';
  const handleMaxBalance = () => setAmount(formattedBalance);

  const handleAction = async () => {
    const amountBigInt = parseUnits(amount, 6);
    const currentAllowance = allowance ? (allowance as bigint) : BigInt(0);

    try {
        if (!localApprovalSuccess && currentAllowance < amountBigInt) {
            setTxStatus('pending');
            const hash = await writeContractAsync({ 
                address: USDC_ADDRESS, abi: ERC20_ABI, functionName: 'approve', args: [CONTRACT_ADDRESS, maxUint256] 
            });
            
            setTxStatus('processing');
            showToast('info', 'Approval submitted', 'Waiting for confirmation...');
            
            const receipt = await waitForReceiptWithStatus(hash);
            if (receipt.status === 'success') {
                showToast('success', 'USDC Approved!', `https://testnet.arcscan.app/tx/${hash}`, 'View Explorer');
                setLocalApprovalSuccess(true); 
                refetchAllowance();
                setTxStatus('idle');
            } else {
                showToast('error', 'Approval failed');
                setTxStatus('idle');
            }
            return;
        }

        setTxStatus('pending');
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

        const hash = await writeContractAsync({ 
            address: CONTRACT_ADDRESS as `0x${string}`, abi: CONTRACT_ABI, functionName: fn as any, args: args as any 
        });

        setTxStatus('processing');
        showToast('info', 'Transaction submitted', 'Waiting for confirmation...');

        const receipt = await waitForReceiptWithStatus(hash);
        if (receipt.status === 'success') {
            showToast('success', 'Escrow created!', `https://testnet.arcscan.app/tx/${hash}`, 'View Explorer');
            setTimeout(() => {
                if (onPaymentCreated) onPaymentCreated();
                resetForm();
            }, 1500);
        } else {
            showToast('error', 'Transaction failed', `https://testnet.arcscan.app/tx/${hash}`, 'View Explorer');
            setTxStatus('idle');
        }

    } catch (error) {
        console.error(error);
        showToast('error', 'Transaction declined or failed');
        setTxStatus('idle');
    }
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
        <div className="w-12 h-12 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center mb-4"><AlertCircle className="w-6 h-6 text-slate-400" /></div>
        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Connect your wallet to access the portal</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 animate-fade-in">
      <style dangerouslySetInnerHTML={{__html: `
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type="number"] { -moz-appearance: textfield; }
      `}} />

      <div className="p-1.5 bg-slate-100 dark:bg-slate-950/50 rounded-xl flex relative w-full border border-slate-200/60 dark:border-slate-800 shadow-inner dark:shadow-black/50">
        {(['Mediated', 'Bonded', 'Timelock'] as const).map((mode) => {
          const isActive = paymentMode === mode;
          return (
            <button key={mode} onClick={() => { if(!isFormDisabled) { setPaymentMode(mode); resetForm(); } }} disabled={isFormDisabled} className={`relative z-10 flex-1 py-2 text-xs font-bold tracking-wide transition-all duration-200 rounded-lg ${isActive ? 'text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.08)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.5)] border border-slate-200 dark:border-slate-700 dark:ring-1 dark:ring-white/10' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 border border-transparent'} disabled:opacity-50 disabled:cursor-not-allowed`}>
              {mode}
            </button>
          );
        })}
      </div>

      <div className="space-y-5">
        <div className="space-y-2 group">
          <label className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1">
            <span className="flex items-center gap-1.5"><User size={12} className="text-slate-400 dark:text-slate-500" /> Receiver Address</span>
          </label>
          <div className="relative flex items-center">
            <input type="text" placeholder="0x..." value={receiver} disabled={isFormDisabled} onChange={(e) => setReceiver(e.target.value)} className="w-full bg-white dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 pr-10 text-slate-900 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600 font-mono text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 dark:focus:ring-indigo-500/40 transition-all dark:shadow-inner dark:shadow-black/20 disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-slate-900" />
            <div className="absolute right-3 flex items-center gap-1.5">
              {!receiver && <button onClick={() => handlePaste(setReceiver)} className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" title="Paste"><ClipboardPaste size={14} /></button>}
              {isValidAddress(receiver) && <CheckCircle2 size={16} className="text-indigo-600 dark:text-indigo-400 animate-scale-in" />}
            </div>
          </div>
        </div>

        {paymentMode === 'Mediated' && (
          <div className="space-y-2 group animate-fade-in-up">
            <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1"><Shield size={12} className="text-slate-400 dark:text-slate-500" /> Arbiter Address</label>
            <div className="relative flex items-center">
              <input type="text" placeholder="0x..." value={arbiter} disabled={isFormDisabled} onChange={(e) => setArbiter(e.target.value)} className="w-full bg-white dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 pr-10 text-slate-900 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600 font-mono text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 dark:focus:ring-indigo-500/40 transition-all dark:shadow-inner dark:shadow-black/20 disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-slate-900" />
              <div className="absolute right-3 flex items-center gap-1.5">
                {!arbiter && <button onClick={() => handlePaste(setArbiter)} className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" title="Paste"><ClipboardPaste size={14} /></button>}
                {isValidAddress(arbiter) && <CheckCircle2 size={16} className="text-indigo-600 dark:text-indigo-400 animate-scale-in" />}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2 group">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1">
            <label className="flex items-center gap-1.5"><DollarSign size={12} className="text-slate-400 dark:text-slate-500" /> Payment Amount</label>
            <div className="flex items-center gap-2">
              <span className="font-mono text-slate-500 dark:text-slate-400 text-[10px] normal-case">{formattedBalance} USDC</span>
              <button type="button" onClick={handleMaxBalance} className="text-[9px] font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 px-2 py-0.5 rounded-md">MAX</button>
            </div>
          </div>
          <div className="relative">
            <input type="number" placeholder="0.00" value={amount} disabled={isFormDisabled} onChange={(e) => setAmount(e.target.value)} className={`w-full bg-white dark:bg-slate-950/50 border rounded-xl px-4 py-3.5 pl-4 pr-20 text-slate-900 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600 font-mono text-lg font-medium focus:outline-none transition-all dark:shadow-inner dark:shadow-black/20 disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-slate-900 ${hasInsufficientBalance ? 'border-rose-400 dark:border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/20' : 'border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 dark:focus:ring-indigo-500/40'}`} />
            <div className="absolute right-3 top-1/2 -translate-y-1/2"><span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 uppercase select-none">USDC</span></div>
          </div>
        </div>

        {paymentMode === 'Timelock' && (
          <div className="space-y-5 animate-fade-in-up">
            <div className="space-y-2 group">
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1"><Snowflake size={12} className="text-slate-400 dark:text-slate-500" /> Cooling-Off Period</label>
              <div className="grid grid-cols-2 gap-4">
                {[ { label: 'Hours', value: coolOffHours, setter: setCoolOffHours, placeholder: '0' }, { label: 'Mins', value: coolOffMins, setter: setCoolOffMins, placeholder: '0' } ].map((item) => (
                  <div key={item.label} className="relative group">
                    <input type="number" min="0" placeholder={item.placeholder} value={item.value} disabled={isFormDisabled} onChange={(e) => item.setter(e.target.value)} className="w-full bg-white dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl py-3 pl-4 pr-16 text-left text-slate-900 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600 font-mono text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 dark:focus:ring-indigo-500/40 transition-all dark:shadow-inner dark:shadow-black/20 disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-slate-900" />
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2"><span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/80 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 uppercase select-none">{item.label}</span></div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="space-y-2 group">
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1"><Clock size={12} className="text-slate-400 dark:text-slate-500" /> Claim Deadline</label>
              <div className="relative group">
                <input type="number" min="1" placeholder="0" value={deadlineHours} disabled={isFormDisabled} onChange={(e) => setDeadlineHours(e.target.value)} className="w-full bg-white dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl py-3 pl-4 pr-16 text-slate-900 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600 font-mono text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 dark:focus:ring-indigo-500/40 transition-all dark:shadow-inner dark:shadow-black/20 disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-slate-900" />
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2"><span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/80 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 uppercase select-none">HOURS</span></div>
              </div>
            </div>
          </div>
        )}

        {paymentMode === 'Bonded' && (
          <div className="space-y-2 group animate-fade-in-up">
            <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1"><Shield size={12} className="text-slate-400 dark:text-slate-500" /> Bond Required</label>
            <div className="relative">
              <input type="number" placeholder="0.00" value={extraValue} disabled={isFormDisabled} onChange={(e) => setExtraValue(e.target.value)} className="w-full bg-white dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 pl-4 pr-20 text-slate-900 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600 font-mono text-base focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 dark:focus:ring-indigo-500/40 transition-all dark:shadow-inner dark:shadow-black/20 disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-slate-900" />
              <div className="absolute right-3 top-1/2 -translate-y-1/2"><span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 uppercase select-none">USDC</span></div>
            </div>
          </div>
        )}

        <div className="pt-3">
          {isFormValid && !hasInsufficientBalance && txStatus === 'idle' && (
            <div className="mb-5 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 flex items-start gap-2.5 animate-fade-in-up">
              <AlertTriangle size={16} className="text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-amber-800 dark:text-amber-200 text-[11px] sm:text-xs font-medium leading-relaxed">
                <strong className="font-bold">Notice:</strong> Your wallet may flag this transaction. This is expected for testnet.
              </p>
            </div>
          )}

          {txStatus === 'idle' && (
            <button onClick={handleAction} disabled={!isFormValid || hasInsufficientBalance} className={`w-full py-3.5 rounded-xl font-bold text-sm uppercase tracking-wide transition-all duration-200 ${isFormValid && !hasInsufficientBalance ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-[0_4px_14px_rgba(79,70,229,0.3)] dark:shadow-[0_4px_20px_rgba(79,70,229,0.4)] active:scale-[0.98]' : hasInsufficientBalance ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400 cursor-not-allowed border border-rose-200 dark:border-rose-500/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-slate-700'}`}>{buttonText}</button>
          )}

          {txStatus !== 'idle' && (
            <div className={`w-full py-3.5 rounded-xl border flex items-center justify-center gap-2.5 text-sm font-bold tracking-wide uppercase border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 animate-pulse`}>
              <Loader2 className="animate-spin text-indigo-600 dark:text-indigo-400" size={16} />
              <span>{txStatus === 'pending' ? 'Confirm in Wallet...' : 'Processing...'}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}