'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Clock, ShieldAlert, Flame, CheckCircle2, BookOpen, Lock, ArrowRight, ShieldCheck, X, Award, Info, BookText } from 'lucide-react';
import { useToast } from './Toast';

const GUIDE_MODULES = [
  {
    id: 1,
    title: "Timelocked Escrow",
    icon: Clock,
    color: "blue",
    shortDesc: "Best for simple freelance work or deposits. Funds are locked for a specific cooldown period.",
    longText: (
      <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
        <p><strong>What is an Escrow?</strong> Simply put, it is a neutral vault. When you want to pay someone for a service, you don't want to pay them before they do the work, and they don't want to do the work unless they know you actually have the money.</p>
        <p><strong>How Timelocked Works:</strong> You (the Sender) deposit USDC into the smart contract. You set a specific "cooldown" period (e.g., 3 days). The funds are locked on the blockchain.</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>The Receiver does the work and delivers the product.</li>
          <li>Once the 3-day cooldown expires, the Receiver is granted permission to click "Claim" and withdraw the funds.</li>
          <li><strong>Protection:</strong> If the Receiver never accepts the job or ghosts you, the contract has a "Hard Deadline." Once that deadline passes, you are granted the authority to safely reclaim the funds back to your wallet.</li>
        </ul>
        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700 mt-4">
          <p className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-2">Real World Example</p>
          <p className="text-xs">You hire a designer to make a logo by Friday. You lock the funds on Monday. By Friday, the designer finishes, the timelock expires, and they claim their pay automatically.</p>
        </div>
      </div>
    )
  },
  {
    id: 2,
    title: "Mediated Escrow",
    icon: ShieldAlert,
    color: "amber",
    shortDesc: "Best for high-value trades. Requires a neutral third-party Arbiter to resolve any potential disputes.",
    longText: (
      <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
        <p><strong>The Trust Problem:</strong> Sometimes you are doing a massive transaction (like buying a digital business) and a simple timer isn't safe enough. What if they deliver a broken product on the last day?</p>
        <p><strong>How Mediated Works:</strong> This introduces a "Multi-Signature" element. When creating the escrow, you assign a trusted 3rd party—an <strong>Arbiter</strong>. </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>If the transaction goes smoothly, you click "Release" and the Receiver gets paid. The Arbiter does nothing.</li>
          <li>If a disagreement happens, either party can click <strong>"Dispute."</strong></li>
          <li>The funds are frozen. The Arbiter reviews the chat logs and evidence.</li>
          <li>The Arbiter has the cryptographic power to either refund the Sender or force the payment to the Receiver.</li>
        </ul>
        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700 mt-4">
          <p className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-2">Real World Example</p>
          <p className="text-xs">You buy a domain name for 5,000 USDC. You use an established Web3 lawyer as the Arbiter. If the seller refuses to transfer the domain, you dispute it, the Arbiter sees the seller lied, and the Arbiter refunds your 5,000 USDC.</p>
        </div>
      </div>
    )
  },
  {
    id: 3,
    title: "Bonded Escrow",
    icon: Flame,
    color: "rose",
    shortDesc: "Best for zero-trust tasks. The receiver must stake their own USDC to accept the job.",
    longText: (
      <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
        <p><strong>The Sybil Problem:</strong> On the internet, anyone can make a fake account, accept your job, and hold your funds hostage just to troll you. How do you ensure the person taking your job is serious?</p>
        <p><strong>How Bonded Works:</strong> Also known as "Skin in the Game." When you lock the payment, you require the Receiver to post a <strong>Bond</strong> (e.g., 50 USDC) just to accept the contract.</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>If the Receiver completes the job successfully, they get your payment <strong>plus</strong> their bond back.</li>
          <li>If the Receiver tries to scam you or fails to deliver, the contract is disputed.</li>
          <li>If the Arbiter rules against the Receiver, their 50 USDC bond is permanently <strong>burned (destroyed)</strong>, and your original payment is refunded to you.</li>
        </ul>
        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700 mt-4">
          <p className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-2">Real World Example</p>
          <p className="text-xs">You offer 500 USDC for a smart contract audit, requiring a 100 USDC bond. An auditor stakes their 100 USDC to prove they are legitimate and won't waste your time. Once they deliver the audit, they walk away with 600 USDC.</p>
        </div>
      </div>
    )
  }
];

export default function Guide() {
  const { showToast } = useToast();
  const [readGuides, setReadGuides] = useState<Set<number>>(new Set());
  const [activeModal, setActiveModal] = useState<number | null>(null);
  const [claimed, setClaimed] = useState(false);

  const handleOpenModal = (id: number) => {
    setActiveModal(id);
  };

  // THE FIX: Clicking the X merely closes the modal without granting progress.
  const handleCloseModal = () => {
    setActiveModal(null);
  };

  // THE FIX: Explicitly confirming grants the progress point.
  const handleUnderstand = () => {
    if (activeModal !== null) {
      setReadGuides(prev => new Set(prev).add(activeModal));
    }
    setActiveModal(null);
  };

  const handleClaimXP = () => {
    if (readGuides.size < 3) return;
    setClaimed(true);
    showToast('success', '50 XP Claimed!', 'Your knowledge has been verified.');
    // TODO: Hook this up to Supabase user_points table later
  };

  const activeModuleData = GUIDE_MODULES.find(m => m.id === activeModal);

  return (
    <div className="w-full space-y-6 animate-fade-in pb-12">
      
      {/* Header Banner */}
      <div className="bg-slate-900 dark:bg-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-lg border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl"></div>
        <div className="relative z-10 flex items-start gap-4">
          <div className="w-12 h-12 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-center shrink-0">
            <BookOpen className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight mb-2">Protocol Documentation</h2>
            <p className="text-slate-400 text-sm leading-relaxed max-w-2xl font-medium">
              Custodex is an enterprise-grade escrow layer. Before interacting with the smart contracts, it is required that you understand the three core infrastructure types.
            </p>
          </div>
        </div>
      </div>

      {/* Clickable Module Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {GUIDE_MODULES.map((mod) => {
          const isRead = readGuides.has(mod.id);
          const Icon = mod.icon;
          
          let colorStyles = '';
          if (mod.color === 'blue') colorStyles = 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400';
          if (mod.color === 'amber') colorStyles = 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400';
          if (mod.color === 'rose') colorStyles = 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400';

          return (
            <button 
              key={mod.id}
              onClick={() => handleOpenModal(mod.id)}
              className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 hover:border-indigo-400 dark:hover:border-indigo-500/60 hover:shadow-md transition-all group flex flex-col relative overflow-hidden"
            >
              {isRead && (
                <div className="absolute top-4 right-4 text-emerald-500 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider">
                  <CheckCircle2 size={14} /> Read
                </div>
              )}
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform ${colorStyles}`}>
                <Icon size={20} />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-2">{mod.title}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4 flex-1">
                {mod.shortDesc}
              </p>
              <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                <BookText size={14} /> Read Module
              </div>
            </button>
          );
        })}
      </div>

      {/* Gamification / Points Hook */}
      <div className="mt-8 pt-8 border-t border-slate-200 dark:border-slate-800 flex flex-col items-center gap-4">
        
        {!claimed && (
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
            <Info size={16} className="text-slate-500" />
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Read all 3 modules to unlock 50 XP ({readGuides.size}/3 completed)
            </span>
          </div>
        )}

        <button 
          onClick={handleClaimXP}
          disabled={claimed || readGuides.size < 3}
          className={`flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold text-sm transition-all active:scale-95 ${
            claimed 
              ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 cursor-default' 
              : readGuides.size === 3 
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 cursor-pointer'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
          }`}
        >
          {claimed ? (
            <><CheckCircle2 size={18} /> XP Claimed</>
          ) : (
            <><Award size={18} /> Claim 50 XP</>
          )}
        </button>
      </div>

      {/* Detailed Reading Modal */}
      {activeModal && activeModuleData && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/80 backdrop-blur-sm animate-fade-in" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden ring-1 ring-black/5 dark:ring-white/5 flex flex-col max-h-[85vh]">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950/50">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  activeModuleData.color === 'blue' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400' :
                  activeModuleData.color === 'amber' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400' :
                  'bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-400'
                }`}>
                  <activeModuleData.icon size={16} />
                </div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100">{activeModuleData.title} Module</h3>
              </div>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-md transition-colors"><X size={16} /></button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto custom-scrollbar">
              {activeModuleData.longText}
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex justify-end">
              <button onClick={handleUnderstand} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs tracking-wide shadow-sm transition-colors">
                I Understand
              </button>
            </div>

          </div>
        </div>, document.body
      )}

    </div>
  );
}