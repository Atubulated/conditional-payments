'use client';

import React, { useState, useEffect } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { AlertTriangle, Flame, X, Loader2 } from 'lucide-react';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from './constants';

interface SlashWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  paymentId: bigint | number | string;
  totalPoolUsdc: string; // To show the user exactly how much is being destroyed/taken
}

export default function SlashWarningModal({ isOpen, onClose, paymentId, totalPoolUsdc }: SlashWarningModalProps) {
  const [confirmText, setConfirmText] = useState('');
  const { data: hash, isPending, writeContract } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) setConfirmText('');
  }, [isOpen]);

  // Close modal automatically on success after a short delay
  useEffect(() => {
    if (isConfirmed) {
      const timer = setTimeout(() => {
        onClose();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isConfirmed, onClose]);

  if (!isOpen) return null;

  const handleSlash = () => {
    if (confirmText !== 'SLASH') return;
    
    writeContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: CONTRACT_ABI,
      functionName: 'slashBondedPayment',
      args: [BigInt(paymentId)],
    });
  };

  const isButtonDisabled = confirmText !== 'SLASH' || isPending || isConfirming || isConfirmed;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md overflow-hidden bg-slate-900 border-2 border-red-500/30 rounded-2xl shadow-[0_0_40px_rgba(239,68,68,0.15)]">
        
        {/* Close Button */}
        {!isPending && !isConfirming && (
          <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        )}

        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
              <Flame className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-white">Mutually Assured Destruction</h2>
          </div>

          {/* Warning Box */}
          <div className="p-4 bg-red-950/30 border border-red-900/50 rounded-xl space-y-3">
            <div className="flex gap-2 text-red-400 font-semibold text-sm">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <p>Warning: This action is permanent and cannot be reversed.</p>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed">
              By proceeding, the total escrow pool of <span className="font-bold text-white">{totalPoolUsdc} USDC</span> will be permanently removed from your control. 
            </p>
            <ul className="text-xs text-slate-400 list-disc pl-5 space-y-1">
              <li><span className="text-red-400 font-medium">50%</span> will be permanently burned from the supply.</li>
              <li><span className="text-red-400 font-medium">50%</span> will be routed to the platform treasury.</li>
            </ul>
          </div>

          {/* Input Verification */}
          {!isConfirmed ? (
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Type <span className="text-red-400">SLASH</span> to confirm
              </label>
              <input
                type="text"
                placeholder="SLASH"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                disabled={isPending || isConfirming}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 font-mono text-center uppercase focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 transition-all"
              />
            </div>
          ) : (
             <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center text-emerald-400 font-medium">
               Funds successfully slashed.
             </div>
          )}

          {/* Action Button */}
          <button
            onClick={handleSlash}
            disabled={isButtonDisabled}
            className={`
              w-full py-3.5 rounded-xl font-bold text-sm uppercase tracking-wide transition-all duration-300 flex justify-center items-center gap-2
              ${isButtonDisabled 
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700' 
                : 'bg-red-600 text-white hover:bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)] hover:shadow-[0_0_30px_rgba(239,68,68,0.6)]'}
            `}
          >
            {isPending || isConfirming ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                Executing Slash...
              </>
            ) : isConfirmed ? (
              'Destruction Complete'
            ) : (
              'Destroy Funds'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}