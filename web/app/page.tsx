'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAccount, useWriteContract, useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import EscrowForm from './EscrowForm';
import ActivityList from './ActivityList';
import ThemeToggle from './ThemeToggle';
import { USDC_ADDRESS, ERC20_ABI, CONTRACT_ADDRESS, CONTRACT_ABI } from './constants';
import { useToast } from './Toast';
import { supabase } from './supabaseClient';
import {
  ShieldCheck, Bell, Activity as ActivityIcon, CheckCircle2, Clock, PlusCircle, X, AlertTriangle, Snowflake, Mail, CheckCircle, XCircle, ChevronRight, ChevronsRight, ChevronsDown, Lock, Code2, MessageSquareQuote, Loader2, Wallet, Flame
} from 'lucide-react';

/* -------------------------------------------------------------------------- */
/* TYPES & CONSTANTS                                                          */
/* -------------------------------------------------------------------------- */

interface Payment {
  id: string; sender: string; receiver: string; arbiter: string; token: string;
  amount: bigint; bondAmount: bigint; deadline: bigint; availableAt: bigint; 
  acceptedAt: bigint; termsHash: string; pType: number; status: number;
  resolvedTo: string; isDeclined?: boolean; hasVerdict?: boolean;
}

const PAYMENT_TYPES = { SIMPLE: 0, TIMELOCKED: 1, MEDIATED: 2, BONDED: 3 };

const truncateAddress = (addr: string) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';

/* -------------------------------------------------------------------------- */
/* HEADER COMPONENT                                                          */
/* -------------------------------------------------------------------------- */

const Header = ({ address, hasWallet, notifications = [], inbox = [], usdcBalance, onNavigate }: any) => {
  const [isBellOpen, setIsBellOpen] = useState(false);
  const [isInboxOpen, setIsInboxOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const [readMessages, setReadMessages] = useState<Set<string>>(new Set());
  const [expandedMsg, setExpandedMsg] = useState<string | null>(null);

  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  useEffect(() => {
    const interval = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch read state from Supabase on mount/wallet connect
  useEffect(() => {
    if (address) {
      const fetchReadState = async () => {
        const { data } = await supabase
          .from('user_read_state')
          .select('read_items')
          .eq('wallet_address', address.toLowerCase())
          .single();
          
        if (data && data.read_items) {
          setReadMessages(new Set(data.read_items));
        } else {
          setReadMessages(new Set());
        }
      };
      fetchReadState();
    } else {
      setReadMessages(new Set());
    }
  }, [address]);

  // Sync back to Supabase
  const markAllAsRead = () => {
    setReadMessages((prev) => {
      const next = new Set(prev);
      inbox.forEach((m: any) => next.add(`${m.id}-${m.status}`));
      
      if (address) {
        supabase.from('user_read_state').upsert({ 
          wallet_address: address.toLowerCase(), 
          read_items: Array.from(next) 
        }).then();
      }
      return next;
    });
  };

  const toggleMsgExpand = (id: string, status: number) => {
    const notifId = `${id}-${status}`;
    setExpandedMsg(expandedMsg === id ? null : id);
    
    setReadMessages((prev) => {
      const next = new Set(prev);
      next.add(notifId);
      
      if (address) {
        supabase.from('user_read_state').upsert({ 
          wallet_address: address.toLowerCase(), 
          read_items: Array.from(next) 
        }).then();
      }
      return next;
    });
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) { setIsBellOpen(false); setIsInboxOpen(false); }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = inbox.filter((m: any) => !readMessages.has(`${m.id}-${m.status}`)).length;

  const formatTimeRemaining = (targetTime: number) => {
    const remaining = targetTime - now;
    if (remaining <= 0) return null;
    const hrs = Math.floor(remaining / 3600);
    const mins = Math.floor((remaining % 3600) / 60);
    const secs = remaining % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-950/70 backdrop-blur-xl h-16 sm:h-20 shrink-0 w-full flex items-center shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
      <div className="w-full px-3 sm:px-6 lg:px-8 h-full flex items-center justify-between max-w-7xl mx-auto gap-2">
        
        {/* LOGO */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-md bg-indigo-600 flex items-center justify-center flex-shrink-0 shadow-sm shadow-indigo-600/30">
            <ShieldCheck className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-bold text-lg sm:text-xl tracking-tight text-indigo-950 dark:text-indigo-50">Custodex</span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-4">
          
          {/* Show toggle here ONLY if wallet is disconnected */}
          {!hasWallet && <ThemeToggle />}

          {hasWallet && (
            <>
              {/* HIDDEN ON MOBILE */}
              <div className="hidden sm:flex bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-lg items-center gap-2 shadow-sm">
                <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest">USDC</span>
                <span className="text-xs font-mono text-slate-900 dark:text-slate-100 font-semibold">{usdcBalance === 'loading' ? '...' : usdcBalance}</span>
              </div>

              <div className="relative flex gap-1 sm:gap-2" ref={dropdownRef}>
                
                {/* Show toggle here if wallet IS connected */}
                <ThemeToggle />

                <button type="button" onClick={() => { setIsInboxOpen(!isInboxOpen); setIsBellOpen(false); }} className={`p-1.5 sm:p-2 rounded-lg transition-all relative border ${isInboxOpen ? 'bg-indigo-100 dark:bg-indigo-500/20 border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 shadow-inner' : 'bg-indigo-50 dark:bg-slate-900 border-indigo-100 dark:border-slate-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-slate-800 shadow-sm'}`}>
                  <Mail className="w-4 h-4 sm:w-4 sm:h-4" />
                  {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-2 h-2 sm:w-2.5 sm:h-2.5 bg-rose-500 rounded-full ring-2 ring-white dark:ring-slate-900 shadow-sm" />}
                </button>

                <button type="button" onClick={() => { setIsBellOpen(!isBellOpen); setIsInboxOpen(false); }} className={`p-1.5 sm:p-2 rounded-lg transition-all relative border ${isBellOpen ? 'bg-indigo-100 dark:bg-indigo-500/20 border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 shadow-inner' : 'bg-indigo-50 dark:bg-slate-900 border-indigo-100 dark:border-slate-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-slate-800 shadow-sm'}`}>
                  <Bell className="w-4 h-4 sm:w-4 sm:h-4" />
                  {notifications.length > 0 && <span className="absolute -top-1 -right-1 w-2 h-2 sm:w-2.5 sm:h-2.5 bg-rose-500 rounded-full ring-2 ring-white dark:ring-slate-900 shadow-sm" />}
                </button>

                {/* INBOX DROPDOWN */}
                {isInboxOpen && (
                  <div className="fixed sm:absolute top-[70px] sm:top-auto sm:mt-12 right-2 sm:right-0 left-2 sm:left-auto sm:w-[340px] max-w-[340px] rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] dark:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] overflow-hidden animate-fade-in z-50">
                    <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/50 flex justify-between items-center">
                      <h3 className="font-bold text-slate-900 dark:text-slate-100 text-xs tracking-wider uppercase">Inbox</h3>
                      <div className="flex items-center gap-3">
                        {inbox.length > 0 && <button type="button" onClick={markAllAsRead} className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors uppercase">Mark Read</button>}
                        <button type="button" onClick={() => setIsInboxOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"><X size={14} /></button>
                      </div>
                    </div>
                    <div className="max-h-[60vh] sm:max-h-[350px] overflow-y-auto">
                      {inbox.length === 0 ? (
                        <div className="p-6 text-center text-slate-500 dark:text-slate-400 text-xs font-medium">No messages</div>
                      ) : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                          {inbox.map((msg: any) => {
                            const notifId = `${msg.id}-${msg.status}`;
                            const isRead = readMessages.has(notifId);
                            const isExpanded = expandedMsg === msg.id;
                            
                            let title = ""; let desc = "";
                            let Icon = CheckCircle;
                            let color = 'text-slate-600 dark:text-slate-400';

                            const isMeSender = address && msg.sender.toLowerCase() === address.toLowerCase();
                            const isMeReceiver = address && msg.receiver.toLowerCase() === address.toLowerCase();
                            
                            const senderText = isMeSender ? 'you' : `the Sender (${truncateAddress(msg.sender)})`;
                            const receiverText = isMeReceiver ? 'you' : `the Receiver (${truncateAddress(msg.receiver)})`;
                            const isSlashed = msg.pType === 3 && msg.status === 3 && msg.resolvedTo === "0x0000000000000000000000000000000000000000";

                            if (msg.isDeclined) {
                              title = 'Escrow Declined'; 
                              desc = isMeReceiver ? `You declined the terms. Funds were returned to ${senderText}.` : `The receiver declined the terms. Funds were returned to ${senderText}.`; 
                              Icon = XCircle; color = 'text-rose-500';
                            } else if (msg.status === 4) {
                              title = 'Payment Refunded'; 
                              desc = `The escrow was cancelled. Funds were returned to ${senderText}.`; 
                              Icon = XCircle; color = 'text-rose-500';
                            } else if (isSlashed) {
                              title = 'Payment Slashed';
                              desc = isMeSender ? 'You disputed this bonded payment. The funds and bond have been permanently burned.' : 'The sender disputed the payment, triggering a slash and burn mechanism. The funds and your bond were burned.';
                              Icon = Flame; color = 'text-rose-500';
                            } else if (msg.status === 3) {
                              if (msg.hasVerdict) {
                                  if (msg.resolvedTo && msg.resolvedTo.toLowerCase() === msg.sender.toLowerCase()) {
                                      title = `Arbitration Resolved`; desc = `Verdict rendered: Funds have been refunded to ${senderText}.`; color = 'text-amber-600';
                                  } else {
                                      title = `Arbitration Resolved`; desc = `Verdict rendered: Funds have been released to ${receiverText}.`; color = 'text-emerald-600';
                                  }
                              } else {
                                  title = `Escrow Completed`; desc = `Funds have been successfully released to ${receiverText}.`; color = 'text-emerald-600';
                              }
                            } else {
                                title = `Terms Accepted`; desc = isMeReceiver ? `You accepted the terms. Escrow is now active.` : `The receiver accepted the terms. Escrow is now active.`; color = 'text-indigo-600 dark:text-indigo-400';
                            }

                            return (
                              <div key={notifId} onClick={() => toggleMsgExpand(msg.id, msg.status)} className={`p-4 cursor-pointer transition-colors ${isRead ? 'hover:bg-slate-50 dark:hover:bg-slate-800/50 opacity-80' : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                <div className="flex gap-3 items-start">
                                  <div className="w-2 flex-shrink-0 flex justify-center pt-1.5">
                                    {!isRead && <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-sm" />}
                                  </div>
                                  <Icon size={16} className={`${color} shrink-0 mt-0.5`} />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center mb-1">
                                      <p className={`text-xs font-bold truncate pr-2 ${isRead ? 'text-slate-700 dark:text-slate-300' : 'text-slate-900 dark:text-slate-100'}`}>{title}</p>
                                      <ChevronRight size={14} className={`text-slate-400 transition-transform shrink-0 ${isExpanded ? 'rotate-90' : ''}`} />
                                    </div>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">{desc}</p>
                                    {isExpanded && (
                                      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2 animate-fade-in">
                                        <div className="flex justify-between text-[11px]">
                                          <span className="text-slate-500 dark:text-slate-400 font-semibold">Amount Involved:</span>
                                          <span className="font-mono text-slate-900 dark:text-slate-100 font-bold">{(Number(msg.amount) / 1e6).toFixed(2)} USDC</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* NOTIFICATIONS DROPDOWN */}
                {isBellOpen && (
                  <div className="fixed sm:absolute top-[70px] sm:top-auto sm:mt-12 right-2 sm:right-0 left-2 sm:left-auto sm:w-[340px] max-w-[340px] rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] dark:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] overflow-hidden animate-fade-in z-50">
                    <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/50 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 dark:text-slate-100 text-xs tracking-wider uppercase">Actions</h3>
                        <span className="bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 py-0.5 px-1.5 rounded text-[9px] font-bold">{notifications.length}</span>
                      </div>
                      <button type="button" onClick={() => setIsBellOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"><X size={14} /></button>
                    </div>
                    <div className="max-h-[60vh] sm:max-h-[350px] overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-slate-500 dark:text-slate-400 text-xs font-medium">No pending actions</div>
                      ) : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                          {notifications.map((n: any) => {
                            const isPending = n.status === 0;
                            const isAccepted = n.status === 1;
                            const isDisputed = n.status === 2;
                            const isTimelocked = n.pType === 1;
                            
                            const isReceiver = address && n.receiver.toLowerCase() === address.toLowerCase();
                            const isSender = address && n.sender.toLowerCase() === address.toLowerCase();
                            const isArbiter = address && n.arbiter.toLowerCase() === address.toLowerCase();

                            const availableAt = Number(n.availableAt);
                            const deadline = Number(n.deadline);
                            const isCoolingOff = isPending && now < availableAt;
                            const isExpired = isPending && now > deadline;

                            let badgeColor = 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border-indigo-100 dark:border-indigo-500/20';
                            let badgeText = 'Payment Request';
                            
                            if (isPending) {
                                if (isSender) badgeText = 'Awaiting Receiver';
                                else if (isReceiver) badgeText = 'Action Required';
                            } else if (isAccepted) {
                                badgeText = 'In Progress'; badgeColor = 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20';
                            }
                            if (isDisputed) { badgeText = isArbiter ? 'Ruling Required' : 'Under Arbitration'; badgeColor = 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20'; }

                            return (
                              <div key={n.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                <div className="flex justify-between items-start mb-3">
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase ${badgeColor}`}>{badgeText}</span>
                                </div>
                                <div className="mb-3 space-y-1.5">
                                  <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-500 dark:text-slate-400 font-semibold uppercase text-[10px]">Amount</span>
                                    <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">{(Number(n.amount) / 1e6).toFixed(2)} USDC</span>
                                  </div>
                                  <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-500 dark:text-slate-400 font-semibold uppercase text-[10px]">
                                      {isSender ? 'To (Receiver)' : isReceiver ? 'From (Sender)' : 'Parties'}
                                    </span>
                                    <span className="font-medium text-slate-600 dark:text-slate-300 font-mono text-[10px]">
                                      {isSender ? truncateAddress(n.receiver) : isReceiver ? truncateAddress(n.sender) : `${truncateAddress(n.sender)} / ${truncateAddress(n.receiver)}`}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex gap-2 flex-wrap pt-2">
                                  {isPending && isReceiver && !isDisputed ? (
                                    <>
                                      {isExpired ? <div className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold rounded-lg flex items-center justify-center border border-slate-200 dark:border-slate-700 uppercase cursor-not-allowed">Offer Expired</div>
                                      : (n.pType === 1 && isCoolingOff) ? <button type="button" disabled className="flex-1 py-2 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold rounded-lg flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700 uppercase cursor-not-allowed"><Snowflake size={12} /> {formatTimeRemaining(availableAt)}</button>
                                      : <button type="button" onClick={() => { setIsBellOpen(false); onNavigate?.(); }} className="flex-1 py-2 bg-indigo-600 text-white text-[10px] font-bold rounded-lg hover:bg-indigo-700 transition-all uppercase shadow-sm active:scale-95">Action Required</button>}
                                    </>
                                  ) : (
                                    <button type="button" onClick={() => { setIsBellOpen(false); onNavigate?.(); }} className="flex-1 py-2 bg-indigo-50 dark:bg-slate-800 text-indigo-700 dark:text-indigo-400 text-[10px] font-bold rounded-lg hover:bg-indigo-100 dark:hover:bg-slate-700 transition-all uppercase shadow-sm border border-indigo-200 dark:border-slate-700">Review in Activity</button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          <div className="flex items-center">
            <ConnectButton.Custom>
              {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
                const connected = mounted && account && chain;
                return (
                  <div style={{ transition: 'opacity 0.2s', opacity: mounted ? 1 : 0 }}>
                    {(() => {
                      if (!connected) {
                        return (
                          <button onClick={openConnectModal} type="button" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 px-3 sm:py-2.5 sm:px-4 rounded-lg transition-all shadow-md shadow-indigo-600/20 active:scale-95 text-[11px] sm:text-xs tracking-wide">
                            Connect Wallet
                          </button>
                        );
                      }
                      if (chain.unsupported) {
                        return (
                          <button onClick={openChainModal} type="button" className="bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 hover:bg-rose-100 dark:hover:bg-rose-500/20 font-bold py-1.5 px-3 sm:py-2 sm:px-4 rounded-lg transition-colors text-[11px] sm:text-xs">
                            Wrong network
                          </button>
                        );
                      }
                      return (
                        <div className="flex items-center gap-1.5">
                          <button onClick={openChainModal} type="button" className="hidden md:flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 py-1.5 px-2.5 rounded-lg transition-colors shadow-sm">
                            {chain.hasIcon && (
                              <div style={{ background: chain.iconBackground, width: 16, height: 16, borderRadius: 999, overflow: 'hidden', marginRight: 6 }}>
                                {chain.iconUrl && <img alt={chain.name ?? 'Chain icon'} src={chain.iconUrl} style={{ width: 16, height: 16 }} />}
                              </div>
                            )}
                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{chain.name}</span>
                          </button>
                          
                          <button onClick={openAccountModal} type="button" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-800 py-1.5 px-2 sm:py-2 sm:px-3 rounded-lg transition-colors shadow-sm flex items-center gap-1.5 group">
                            <Wallet className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors" />
                            <span className="text-[10px] sm:text-xs font-mono text-slate-900 dark:text-slate-100 font-semibold group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">{account.displayName}</span>
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                );
              }}
            </ConnectButton.Custom>
          </div>
        </div>
      </div>
    </header>
  );
};

// FULL-WIDTH SEGMENTED CONTROL TABS
const TabButton = ({ active, onClick, icon: Icon, label }: any) => (
  <button onClick={onClick} className={`flex-1 flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 rounded-md text-[11px] sm:text-xs font-bold tracking-wide transition-all duration-200 ${active ? 'bg-indigo-600 text-white shadow-sm border border-indigo-700' : 'text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 border border-transparent'}`}>
    <Icon size={14} className="hidden sm:block" />{label}
  </button>
);

/* -------------------------------------------------------------------------- */
/* MAIN PAGE                                                                  */
/* -------------------------------------------------------------------------- */

export default function Home() {
  const { address, status } = useAccount();
  const { showToast } = useToast();
  
  const [mounted, setMounted] = useState(false);
  const [isSettled, setIsSettled] = useState(false);
  const hasWallet = !!address;

  const [activeTab, setActiveTab] = useState('create');
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState('Bug Report');
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  const [pendingPayments, setPendingPayments] = useState<Payment[]>([]);
  const [inboxMessages, setInboxMessages] = useState<Payment[]>([]); 

  const { data: balanceData } = useReadContract({
    address: USDC_ADDRESS as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 2000 }
  });
  const formattedBalance = balanceData ? Number(formatUnits(balanceData as bigint, 6)).toFixed(2) : '0.00';

  useEffect(() => {
    setMounted(true);
    const failsafeTimer = setTimeout(() => setIsSettled(true), 800);
    if (status === 'connected' || status === 'disconnected') {
      setIsSettled(true);
      clearTimeout(failsafeTimer);
    }
    return () => clearTimeout(failsafeTimer);
  }, [status]);

  const handleFeedbackSubmit = async () => {
    if (!feedbackMsg.trim()) return;
    setIsSubmittingFeedback(true);
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: feedbackType, message: feedbackMsg, address: address || null }),
      });
      if (!response.ok) throw new Error('Failed');
      setIsFeedbackOpen(false); setFeedbackMsg('');
      showToast('success', 'Feedback Submitted!');
    } catch (error) { showToast('error', 'Submission Failed'); } 
    finally { setIsSubmittingFeedback(false); }
  };

  const fetchPendingPayments = useCallback(async () => {
    if (!address) return;
    try {
      const userAddr = address.toLowerCase();
      
      const [paymentsRes, verdictsRes] = await Promise.all([
          supabase.from('escrow_payments').select('*').or(`sender.eq.${userAddr},receiver.eq.${userAddr},arbiter.eq.${userAddr}`),
          supabase.from('arbiter_chat').select('payment_id').ilike('message', 'VERDICT RENDERED%')
      ]);

      if (paymentsRes.error) throw paymentsRes.error;

      const verdictSet = new Set(verdictsRes.data?.map(v => String(v.payment_id)) || []);

      if (paymentsRes.data) {
        const actionablePayments: any[] = [];
        const historyPayments: any[] = [];

        // Sort numerically in Javascript so "10" doesn't hide behind "9"
        const sortedData = paymentsRes.data.sort((a: any, b: any) => Number(b.id) - Number(a.id));

        sortedData.forEach((d: any) => {
          const payment = {
            id: String(d.id), sender: d.sender, receiver: d.receiver, arbiter: d.arbiter, token: '0x...',
            amount: d.amount, bondAmount: d.bond_amount, deadline: d.deadline, availableAt: d.available_at,
            pType: d.p_type, status: d.status, isDeclined: d.is_declined, resolvedTo: d.resolved_to,
            hasVerdict: verdictSet.has(String(d.id))
          };
          if (payment.isDeclined || payment.status === 3 || payment.status === 4) {
            historyPayments.push(payment);
          } else if (payment.status === 0 || payment.status === 1 || payment.status === 2) {
            actionablePayments.push(payment);
          }
        });

        setPendingPayments((prev) => JSON.stringify(prev) === JSON.stringify(actionablePayments) ? prev : actionablePayments);
        setInboxMessages((prev) => JSON.stringify(prev) === JSON.stringify(historyPayments) ? prev : historyPayments);
      }
    } catch (e) {
      console.warn("Background sync delayed");
    }
  }, [address]);

  const syncNewEscrows = useCallback(async () => {
    if (!address || !window.ethereum) return;
    try {
      const { ethers } = await import('ethers');
      
      const provider = new ethers.BrowserProvider(window.ethereum as any);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI as any, provider);

      // Stop infinite loop by correctly calculating the highest numeric ID
      const { data } = await supabase.from('escrow_payments').select('id');
      let nextId = 0;
      if (data && data.length > 0) {
         nextId = Math.max(...data.map((d: any) => Number(d.id))) + 1;
      }

      let foundNew = false;
      while (true) {
        try {
          const p = await contract.getPayment(BigInt(nextId));
          if (p[0] === '0x0000000000000000000000000000000000000000') break;

          await supabase.from('escrow_payments').upsert({
            id: nextId.toString(),
            sender: p[0].toLowerCase(),
            receiver: p[1].toLowerCase(),
            arbiter: p[2].toLowerCase(),
            amount: p[4].toString(),
            bond_amount: p[5].toString(),
            deadline: p[6].toString(),
            available_at: p[7].toString(),
            p_type: Number(p[10]),
            status: Number(p[11]),
            resolved_to: p[13]?.toLowerCase()
          }, { onConflict: 'id' });

          nextId++;
          foundNew = true;
        } catch (err) { break; } 
      }
      if (foundNew) fetchPendingPayments();
    } catch(e) {}
  }, [address, fetchPendingPayments]);

  useEffect(() => {
    if (hasWallet) { 
        fetchPendingPayments(); 
        
        const initialDelay = setTimeout(() => {
             syncNewEscrows();
        }, 1500);

        const interval = setInterval(() => {
            fetchPendingPayments();
            syncNewEscrows();
        }, 5000); 
        
        return () => {
            clearTimeout(initialDelay);
            clearInterval(interval); 
        };
    }
  }, [hasWallet, fetchPendingPayments, syncNewEscrows]);

  if (!mounted || !isSettled) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center relative z-50">
        <div className="w-14 h-14 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30 mb-6 animate-pulse">
          <ShieldCheck className="w-8 h-8 text-white" strokeWidth={2.5} />
        </div>
        <div className="flex items-center gap-3 text-indigo-900 dark:text-indigo-100 font-bold text-xs tracking-widest uppercase">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-600 dark:text-indigo-400" />
          Initializing Protocol
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col font-sans overflow-x-hidden relative selection:bg-indigo-100 dark:selection:bg-indigo-900 selection:text-indigo-900 dark:selection:text-indigo-100">
      
      <div className="fixed inset-0 pointer-events-none z-0 flex justify-center overflow-hidden">
        {/* Light Mode Grid */}
        <div className="absolute inset-0 dark:hidden opacity-[0.5]" style={{ backgroundImage: 'linear-gradient(to right, rgba(79, 70, 229, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(79, 70, 229, 0.05) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        
        {/* Dark Mode Grid */}
        <div className="absolute inset-0 hidden dark:block opacity-[0.25]" style={{ backgroundImage: 'linear-gradient(to right, rgba(99, 102, 241, 0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(99, 102, 241, 0.2) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        
        {/* Glow Effect */}
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-indigo-500/10 dark:bg-indigo-500/30 rounded-full blur-[120px]" />
      </div>

      {hasWallet && (
        <>
          <div className="flex fixed right-0 top-1/2 -translate-y-1/2 z-[60]">
            <button onClick={() => setIsFeedbackOpen(true)} className="bg-indigo-600 text-white hover:bg-indigo-700 py-3 px-1.5 sm:py-4 sm:px-2 rounded-l-lg shadow-md shadow-indigo-600/20 border border-r-0 border-indigo-700 transition-colors flex flex-col items-center gap-2">
              <MessageSquareQuote size={12} className="sm:w-[14px] sm:h-[14px] text-indigo-50" />
              <span className="[writing-mode:vertical-lr] font-bold tracking-widest text-[8px] sm:text-[9px] rotate-180 uppercase mt-0.5 text-white">Feedback</span>
            </button>
          </div>

          {isFeedbackOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/20 dark:bg-black/60 backdrop-blur-sm animate-fade-in">
              <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl dark:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)] p-6">
                <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2"><MessageSquareQuote className="text-indigo-600 dark:text-indigo-400" size={16} /> Submit Feedback</h2>
                  <button onClick={() => setIsFeedbackOpen(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors bg-slate-50 dark:bg-slate-800 p-1.5 rounded-md"><X size={14} /></button>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Type</label>
                    <div className="flex gap-2">
                      {['Bug', 'Feature', 'General'].map(type => (
                        <button key={type} onClick={() => setFeedbackType(type)} className={`flex-1 py-2 rounded-md text-xs font-bold transition-all border ${feedbackType === type ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-500/50 shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Message</label>
                    <textarea rows={4} placeholder="Describe your experience..." value={feedbackMsg} onChange={(e) => setFeedbackMsg(e.target.value)} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md p-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500/20 transition-all resize-none shadow-inner dark:shadow-none"/>
                  </div>

                  <button onClick={handleFeedbackSubmit} disabled={isSubmittingFeedback || !feedbackMsg.trim()} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-bold text-xs transition-all shadow-md shadow-indigo-600/20 active:scale-95 flex justify-center items-center gap-2 disabled:opacity-50">
                    {isSubmittingFeedback ? <Loader2 className="animate-spin" size={14} /> : 'Send Feedback'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <Header 
        address={address} 
        hasWallet={hasWallet} 
        notifications={pendingPayments} 
        inbox={inboxMessages} 
        usdcBalance={formattedBalance} 
        onNavigate={() => setActiveTab('activity')}
      />

      <main className={`flex-1 flex flex-col items-center px-4 sm:px-6 w-full mx-auto relative z-10 ${!hasWallet ? 'justify-center py-10 sm:py-16 max-w-5xl' : 'py-8 sm:py-12 max-w-4xl'}`}>
        {!hasWallet ? (
          <div className="w-full flex flex-col items-center space-y-10 sm:space-y-14 animate-fade-in">
            <div className="text-center space-y-4 sm:space-y-5 px-2 relative z-10">
              <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tighter leading-[1.05]">
                <span className="text-slate-900 dark:text-slate-100">Trustless Payments.</span><br/>
                <span className="text-indigo-600 dark:text-indigo-400">Settled Instantly.</span>
              </h1>
              <p className="text-sm sm:text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto font-medium leading-relaxed">
                The enterprise escrow protocol. Secure any transaction with conditional logic, arbiters, and cryptographic bonds.
              </p>
            </div>

            <div className="flex flex-col md:flex-row items-center md:items-stretch justify-center gap-4 sm:gap-6 w-full relative z-10 pt-2">
              <div className="group w-full md:w-auto p-5 sm:p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-none hover:shadow-md dark:hover:border-indigo-500/50 hover:border-indigo-200 transition-all flex-1 flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-3 sm:mb-4 group-hover:scale-105 transition-transform"><Lock size={20} /></div>
                <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100 mb-1.5">1. Lock Assets</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">Sender deposits USDC into the non-custodial contract. Funds are secured on-chain.</p>
              </div>

              <div className="hidden md:flex items-center text-indigo-200 dark:text-slate-700"><ChevronsRight size={20} /></div>
              <div className="flex md:hidden items-center text-indigo-200 dark:text-slate-700"><ChevronsDown size={20} /></div>

              <div className="group w-full md:w-auto p-5 sm:p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-none hover:shadow-md dark:hover:border-indigo-500/50 hover:border-indigo-200 transition-all flex-1 flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-3 sm:mb-4 group-hover:scale-105 transition-transform"><Code2 size={20} /></div>
                <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100 mb-1.5">2. Define Logic</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">Set precise conditions for release: expiry dates, arbiters, or performance bonds.</p>
              </div>

              <div className="hidden md:flex items-center text-indigo-200 dark:text-slate-700"><ChevronsRight size={20} /></div>
              <div className="flex md:hidden items-center text-indigo-200 dark:text-slate-700"><ChevronsDown size={20} /></div>

              <div className="group w-full md:w-auto p-5 sm:p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-none hover:shadow-md dark:hover:border-indigo-500/50 hover:border-indigo-200 transition-all flex-1 flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-3 sm:mb-4 group-hover:scale-105 transition-transform"><CheckCircle2 size={20} /></div>
                <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100 mb-1.5">3. Execute</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">When conditions are met, the contract autonomously releases funds. Zero trust required.</p>
              </div>
            </div>

            <div className="pt-2 pb-6 flex flex-col items-center w-full relative z-10">
              <ConnectButton.Custom>
                {({ openConnectModal }) => (
                  <button onClick={openConnectModal} className="px-8 py-3.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg font-bold text-sm tracking-wide shadow-md shadow-indigo-600/20 active:scale-[0.98] transition-transform flex items-center gap-2">
                    Launch Platform <ChevronRight size={16} />
                  </button>
                )}
              </ConnectButton.Custom>
            </div>
          </div>
        ) : (
          <div className="animate-fade-in w-full flex flex-col items-center gap-6">
            <div className="flex justify-center p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm w-full max-w-md">
              <TabButton active={activeTab === 'create'} onClick={() => setActiveTab('create')} icon={PlusCircle} label="New Escrow" />
              <TabButton active={activeTab === 'activity'} onClick={() => setActiveTab('activity')} icon={ActivityIcon} label="Activity" />
            </div>
            
            <div className="w-full flex justify-center min-h-[400px]">
              {activeTab === 'create' ? (
                <div className="w-full max-w-md bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 sm:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)] dark:ring-1 dark:ring-white/5">
                  <EscrowForm onPaymentCreated={() => { setActiveTab('activity'); setTimeout(() => fetchPendingPayments(), 500); }} />
                </div>
              ) : (
                <div className="w-full max-w-2xl">
                  <ActivityList className="w-full" />
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="w-full py-5 px-3 border-t border-slate-200/50 dark:border-slate-800/50 bg-transparent flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6 text-[8px] sm:text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest z-20">
        <span className="cursor-default shrink-0">© 2026 Custodex</span>
        <div className="flex flex-wrap justify-center items-center gap-1.5 sm:gap-4">
          <a href="https://faucet.circle.com/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors underline decoration-indigo-200 dark:decoration-indigo-900 hover:decoration-indigo-400 dark:hover:decoration-indigo-500 underline-offset-2 sm:underline-offset-4">USDC Faucet</a>
          <span className="text-slate-300 dark:text-slate-700">•</span>
          <a href="https://testnet.arcscan.app/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors underline decoration-indigo-200 dark:decoration-indigo-900 hover:decoration-indigo-400 dark:hover:decoration-indigo-500 underline-offset-2 sm:underline-offset-4">Arc Explorer</a>
        </div>
      </footer>

    </div>
  );
}