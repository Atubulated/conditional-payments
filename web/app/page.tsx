'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAccount, useWriteContract, useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import EscrowForm from './EscrowForm';
import ActivityList from './ActivityList';
import SlashWarningModal from './SlashWarningModal'; 
import { USDC_ADDRESS, ERC20_ABI, CONTRACT_ADDRESS, CONTRACT_ABI } from './constants';
import { useToast } from './Toast';
import {
  ShieldCheck, Bell, Activity as ActivityIcon, CheckCircle2, Clock, PlusCircle, X, AlertTriangle, Snowflake, Mail, CheckCircle, XCircle, ChevronRight, ChevronsRight, ChevronsDown, Lock, Code2, MessageSquareQuote, Loader2, Wallet
} from 'lucide-react';

/* -------------------------------------------------------------------------- */
/* TYPES & CONSTANTS                                                          */
/* -------------------------------------------------------------------------- */

interface Payment {
  id: string; sender: string; receiver: string; arbiter: string; token: string;
  amount: bigint; bondAmount: bigint; deadline: bigint; availableAt: bigint; 
  acceptedAt: bigint; termsHash: string; pType: number; status: number;
  resolvedTo: string; 
}

const PAYMENT_TYPES = { SIMPLE: 0, TIMELOCKED: 1, MEDIATED: 2, BONDED: 3 };
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

const truncateAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

/* -------------------------------------------------------------------------- */
/* ARBITER CONFIRMATION MODAL                                                */
/* -------------------------------------------------------------------------- */
function ArbiterConfirmModal({ isOpen, onClose, onConfirm, actionData }: any) {
  const [confirmText, setConfirmText] = useState('');
  
  useEffect(() => { if (!isOpen) setConfirmText(''); }, [isOpen]);
  if (!isOpen || !actionData) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-sm overflow-hidden bg-white border border-slate-200 rounded-xl shadow-xl">
        <div className="p-6 space-y-5">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center border border-rose-100">
              <AlertTriangle className="w-6 h-6 text-rose-500" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Confirm Verdict</h2>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <p className="text-slate-600 text-xs leading-relaxed text-center font-medium">
              You are about to irreversibly disburse funds to the <strong className="text-slate-900">{actionData.label}</strong>.
            </p>
            <div className="bg-white p-2 rounded text-[10px] text-center font-mono text-slate-500 break-all border border-slate-200 shadow-sm">
              {actionData.winner}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center block">
              Type <span className="text-slate-900">CONFIRM</span> to execute
            </label>
            <input
              type="text" placeholder="CONFIRM" value={confirmText} onChange={(e) => setConfirmText(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-slate-900 placeholder:text-slate-400 font-mono text-sm text-center uppercase focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all shadow-sm"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wide text-slate-600 bg-white hover:bg-slate-50 transition-colors border border-slate-300 shadow-sm">Cancel</button>
            <button
              onClick={() => { if (confirmText === 'CONFIRM') onConfirm(actionData.id, actionData.winner); }}
              disabled={confirmText !== 'CONFIRM'}
              className={`flex-1 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wide transition-all border ${confirmText === 'CONFIRM' ? 'bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-700 shadow-sm active:scale-95' : 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200'}`}
            >
              Execute
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* HEADER COMPONENT                                                          */
/* -------------------------------------------------------------------------- */

const Header = ({ address, hasWallet, notifications = [], inbox = [], usdcBalance }: any) => {
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

  useEffect(() => {
    if (address) {
      const saved = localStorage.getItem(`custodex_read_${address}`);
      if (saved) { try { setReadMessages(new Set(JSON.parse(saved))); } catch (e) {} }
    } else {
      setReadMessages(new Set());
    }
  }, [address]);

  const markAllAsRead = () => {
    setReadMessages((prev) => {
      const next = new Set(prev);
      inbox.forEach((m: any) => next.add(String(m.id)));
      if (address) localStorage.setItem(`custodex_read_${address}`, JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const toggleMsgExpand = (id: string) => {
    setExpandedMsg(expandedMsg === id ? null : id);
    setReadMessages((prev) => {
      const next = new Set(prev);
      next.add(String(id));
      if (address) localStorage.setItem(`custodex_read_${address}`, JSON.stringify(Array.from(next)));
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

  const unreadCount = inbox.filter((m: any) => !readMessages.has(String(m.id))).length;

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
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/70 backdrop-blur-xl h-16 sm:h-20 shrink-0 w-full flex items-center shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
      <div className="w-full px-3 sm:px-6 lg:px-8 h-full flex items-center justify-between max-w-7xl mx-auto gap-2">
        
        {/* LOGO */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-md bg-indigo-600 flex items-center justify-center flex-shrink-0 shadow-sm shadow-indigo-600/30">
            <ShieldCheck className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-bold text-lg sm:text-xl tracking-tight text-indigo-950">Custodex</span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-4">
          
          {hasWallet && (
            <>
              {/* HIDDEN ON MOBILE */}
              <div className="hidden sm:flex bg-white border border-slate-200 px-3 py-1.5 rounded-lg items-center gap-2 shadow-sm">
                <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest">USDC</span>
                <span className="text-xs font-mono text-slate-900 font-semibold">{usdcBalance === 'loading' ? '...' : usdcBalance}</span>
              </div>

              <div className="relative flex gap-1 sm:gap-2" ref={dropdownRef}>
                <button onClick={() => { setIsInboxOpen(!isInboxOpen); setIsBellOpen(false); }} className={`p-1.5 sm:p-2 rounded-lg transition-all relative border ${isInboxOpen ? 'bg-indigo-100 border-indigo-200 text-indigo-700 shadow-inner' : 'bg-indigo-50 border-indigo-100 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700 shadow-sm'}`}>
                  <Mail className="w-4 h-4 sm:w-4 sm:h-4" />
                  {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-2 h-2 sm:w-2.5 sm:h-2.5 bg-rose-500 rounded-full ring-2 ring-white" />}
                </button>

                <button onClick={() => { setIsBellOpen(!isBellOpen); setIsInboxOpen(false); }} className={`p-1.5 sm:p-2 rounded-lg transition-all relative border ${isBellOpen ? 'bg-indigo-100 border-indigo-200 text-indigo-700 shadow-inner' : 'bg-indigo-50 border-indigo-100 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700 shadow-sm'}`}>
                  <Bell className="w-4 h-4 sm:w-4 sm:h-4" />
                  {notifications.length > 0 && <span className="absolute -top-1 -right-1 w-2 h-2 sm:w-2.5 sm:h-2.5 bg-rose-500 rounded-full ring-2 ring-white" />}
                </button>

                {/* INBOX DROPDOWN - FIXED FOR MOBILE */}
                {isInboxOpen && (
                  <div className="fixed sm:absolute top-[70px] sm:top-auto sm:mt-12 right-2 sm:right-0 left-2 sm:left-auto sm:w-[340px] max-w-[340px] rounded-xl bg-white border border-slate-200 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] overflow-hidden animate-fade-in z-50">
                    <div className="p-3 border-b border-slate-100 bg-slate-50/80 flex justify-between items-center">
                      <h3 className="font-bold text-slate-900 text-xs tracking-wider uppercase">Inbox</h3>
                      <div className="flex items-center gap-3">
                        {inbox.length > 0 && <button onClick={markAllAsRead} className="text-[9px] font-bold text-indigo-600 hover:text-indigo-700 transition-colors uppercase">Mark Read</button>}
                        <button onClick={() => setIsInboxOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={14} /></button>
                      </div>
                    </div>
                    <div className="max-h-[60vh] sm:max-h-[350px] overflow-y-auto">
                      {inbox.length === 0 ? (
                        <div className="p-6 text-center text-slate-500 text-xs font-medium">No messages</div>
                      ) : (
                        <div className="divide-y divide-slate-100">
                          {inbox.map((msg: any) => {
                            const isRead = readMessages.has(String(msg.id));
                            const isExpanded = expandedMsg === msg.id;
                            
                            let title = ""; let desc = "";
                            let Icon = CheckCircle;
                            let color = 'text-slate-600';

                            if (msg.status === 4) {
                              title = `Payment Refunded`; desc = `Funds returned.`; Icon = XCircle; color = 'text-rose-500';
                            } else if (msg.status === 3) {
                              if (msg.resolvedTo.toLowerCase() === msg.sender.toLowerCase()) {
                                  title = `Arbitration Completed`; desc = `Funds returned.`;
                              } else {
                                  title = `Arbitration Completed`; desc = `Funds released.`; color = 'text-emerald-600';
                              }
                            } else {
                                title = `Terms Accepted`; desc = `Escrow in progress.`; color = 'text-indigo-600';
                            }

                            return (
                              <div key={msg.id} onClick={() => toggleMsgExpand(msg.id)} className={`p-4 cursor-pointer transition-colors ${isRead ? 'hover:bg-slate-50 opacity-80' : 'bg-white hover:bg-slate-50'}`}>
                                <div className="flex gap-3 items-start relative">
                                  {!isRead && <div className="absolute -left-1.5 top-1.5 w-2 h-2 rounded-full bg-indigo-500" />}
                                  <Icon size={16} className={`${color} shrink-0 mt-0.5`} />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center mb-1">
                                      <p className={`text-xs font-bold truncate pr-2 ${isRead ? 'text-slate-700' : 'text-slate-900'}`}>{title}</p>
                                      <ChevronRight size={14} className={`text-slate-400 transition-transform shrink-0 ${isExpanded ? 'rotate-90' : ''}`} />
                                    </div>
                                    <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">{desc}</p>
                                    
                                    {isExpanded && (
                                      <div className="mt-3 pt-3 border-t border-slate-100 space-y-2 animate-fade-in">
                                        <div className="flex justify-between text-[11px]">
                                          <span className="text-slate-500 font-semibold">Amount:</span>
                                          <span className="font-mono text-slate-900 font-bold">{(Number(msg.amount) / 1e6).toFixed(2)} USDC</span>
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

                {/* NOTIFICATIONS DROPDOWN - FIXED FOR MOBILE */}
                {isBellOpen && (
                  <div className="fixed sm:absolute top-[70px] sm:top-auto sm:mt-12 right-2 sm:right-0 left-2 sm:left-auto sm:w-[340px] max-w-[340px] rounded-xl bg-white border border-slate-200 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] overflow-hidden animate-fade-in z-50">
                    <div className="p-3 border-b border-slate-100 bg-slate-50/80 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 text-xs tracking-wider uppercase">Actions</h3>
                        <span className="bg-indigo-100 text-indigo-700 py-0.5 px-1.5 rounded text-[9px] font-bold">{notifications.length}</span>
                      </div>
                      <button onClick={() => setIsBellOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={14} /></button>
                    </div>
                    <div className="max-h-[60vh] sm:max-h-[350px] overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-slate-500 text-xs font-medium">No pending actions</div>
                      ) : (
                        <div className="divide-y divide-slate-100">
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

                            let badgeColor = 'text-indigo-600 bg-indigo-50 border-indigo-100';
                            let badgeText = 'Payment Request';
                            
                            if (isPending) {
                                if (isSender) badgeText = 'Awaiting Receiver';
                                else if (isReceiver) badgeText = 'Action Required';
                            } else if (isAccepted) {
                                badgeText = 'In Progress'; badgeColor = 'text-emerald-600 bg-emerald-50 border-emerald-100';
                            }
                            if (isDisputed) { badgeText = isArbiter ? 'Ruling Required' : 'Under Arbitration'; badgeColor = 'text-amber-600 bg-amber-50 border-amber-100'; }

                            return (
                              <div key={n.id} className="p-4 hover:bg-slate-50 transition-colors">
                                <div className="flex justify-between items-start mb-3">
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase ${badgeColor}`}>{badgeText}</span>
                                </div>
                                
                                <div className="mb-3 space-y-1.5">
                                  <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-500 font-semibold uppercase text-[10px]">Amount</span>
                                    <span className="font-bold text-slate-900 font-mono">{(Number(n.amount) / 1e6).toFixed(2)} USDC</span>
                                  </div>
                                </div>

                                <div className="flex gap-2 flex-wrap pt-2">
                                  {isPending && isReceiver && isTimelocked && !isDisputed && (
                                    <>
                                      {isExpired ? <div className="flex-1 py-2 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-lg flex items-center justify-center border border-slate-200 uppercase cursor-not-allowed">Offer Expired</div>
                                      : isCoolingOff ? <button disabled className="flex-1 py-2 bg-slate-50 text-slate-500 text-[10px] font-bold rounded-lg flex items-center justify-center gap-1.5 border border-slate-200 uppercase cursor-not-allowed"><Snowflake size={12} /> {formatTimeRemaining(availableAt)}</button>
                                      : <button className="flex-1 py-2 bg-indigo-600 text-white text-[10px] font-bold rounded-lg hover:bg-indigo-700 transition-all uppercase shadow-sm active:scale-95">Claim Payment</button>}
                                    </>
                                  )}
                                  {isPending && isSender && !isDisputed && (
                                    <div className="flex-1 py-2 bg-slate-50 text-slate-500 text-[10px] font-bold rounded-lg flex items-center justify-center gap-1.5 border border-slate-200 uppercase cursor-not-allowed"><Clock size={12} /> Waiting</div>
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

          {/* CUSTOM RAINBOWKIT BUTTON */}
          <div className="flex items-center">
            <ConnectButton.Custom>
              {({ account, chain, openAccountModal, openChainModal, openConnectModal, authenticationStatus, mounted }) => {
                const ready = mounted && authenticationStatus !== 'loading';
                const connected = ready && account && chain && (!authenticationStatus || authenticationStatus === 'authenticated');
                return (
                  <div {...(!ready && { 'aria-hidden': true, style: { opacity: 0, pointerEvents: 'none', userSelect: 'none' } })}>
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
                          <button onClick={openChainModal} type="button" className="bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 font-bold py-1.5 px-3 sm:py-2 sm:px-4 rounded-lg transition-colors text-[11px] sm:text-xs">
                            Wrong network
                          </button>
                        );
                      }
                      return (
                        <div className="flex items-center gap-1.5">
                          <button onClick={openChainModal} type="button" className="hidden md:flex items-center bg-white border border-slate-200 hover:bg-slate-50 py-1.5 px-2.5 rounded-lg transition-colors shadow-sm">
                            {chain.hasIcon && (
                              <div style={{ background: chain.iconBackground, width: 16, height: 16, borderRadius: 999, overflow: 'hidden', marginRight: 6 }}>
                                {chain.iconUrl && <img alt={chain.name ?? 'Chain icon'} src={chain.iconUrl} style={{ width: 16, height: 16 }} />}
                              </div>
                            )}
                            <span className="text-[11px] font-bold text-slate-700">{chain.name}</span>
                          </button>
                          
                          <button onClick={openAccountModal} type="button" className="bg-white border border-slate-200 hover:bg-indigo-50 py-1.5 px-2 sm:py-2 sm:px-3 rounded-lg transition-colors shadow-sm flex items-center gap-1.5 group">
                            <Wallet className="w-3.5 h-3.5 text-indigo-600 group-hover:text-indigo-700 transition-colors" />
                            <span className="text-[10px] sm:text-xs font-mono text-slate-900 font-semibold group-hover:text-indigo-700 transition-colors">{account.displayName}</span>
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
  <button onClick={onClick} className={`flex-1 flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 rounded-md text-[11px] sm:text-xs font-bold tracking-wide transition-all duration-200 ${active ? 'bg-indigo-600 text-white shadow-sm border border-indigo-700' : 'text-slate-500 hover:text-indigo-600 border border-transparent'}`}>
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

  const { writeContractAsync } = useWriteContract();

  const [pendingPayments, setPendingPayments] = useState<Payment[]>([]);
  const [inboxMessages, setInboxMessages] = useState<Payment[]>([]); 
  const [slashPayment, setSlashPayment] = useState<Payment | null>(null);
  const [arbiterAction, setArbiterAction] = useState<{id: string, winner: string, label: string} | null>(null);

  const { data: balanceData } = useReadContract({
    address: USDC_ADDRESS as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 2000 }
  });
  const formattedBalance = balanceData ? Number(formatUnits(balanceData as bigint, 6)).toFixed(2) : '0.00';

  // THE FAILSAFE HYDRATION MACHINE
  useEffect(() => {
    setMounted(true);
    
    // This timer acts as a ceiling limit. 
    // It guarantees the loading screen will drop after exactly 800ms, 
    // saving you from 15-second RPC/Wallet hangs forever.
    const failsafeTimer = setTimeout(() => {
      setIsSettled(true);
    }, 800);

    // If Wagmi answers normally before 800ms, we drop the loading screen early
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

  /* -------------------------- DATA FETCHING -------------------------- */
  const fetchPendingPayments = useCallback(async () => {
    if (!hasWallet || typeof window === 'undefined' || !window.ethereum) return;
    try {
      // @ts-ignore
      const { ethers } = await import('ethers');
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI as any, provider);

      const actionablePayments: any[] = [];
      const historyPayments: any[] = [];
      const currentUser = address.toLowerCase();
      const emptyAddress = '0x0000000000000000000000000000000000000000';

      let currentId = 0; const maxChecks = 30; let rpcFailed = false;

      while (currentId < maxChecks) {
        try {
          const p = await contract.getPayment(BigInt(currentId));
          const sender = p[0].toLowerCase();
          const receiver = p[1].toLowerCase();
          const arbiter = p[2].toLowerCase(); 

          if (sender !== emptyAddress && (sender === currentUser || receiver === currentUser || arbiter === currentUser)) {
            const payment = {
              id: currentId.toString(), sender: p[0], receiver: p[1], arbiter: p[2], token: p[3],
              amount: p[4].toString(), bondAmount: p[5].toString(), deadline: p[6].toString(), availableAt: p[7].toString(), acceptedAt: p[8].toString(), termsHash: p[9], 
              pType: Number(p[10]), status: Number(p[11]), resolvedTo: p[13] 
            };
            if (payment.status === 0 || payment.status === 1 || payment.status === 2) { actionablePayments.push(payment); } 
            else if (payment.status === 3 || payment.status === 4) { historyPayments.push(payment); }
          }
          currentId++;
        } catch (err: any) { if (err.code !== 'CALL_EXCEPTION' && !err.message?.includes('revert')) { rpcFailed = true; } break; }
      }

      if (rpcFailed) return; 

      const sortedActionable = actionablePayments.sort((a, b) => Number(b.id) - Number(a.id));
      const sortedHistory = historyPayments.sort((a, b) => Number(b.id) - Number(a.id));

      setPendingPayments((prev) => JSON.stringify(prev) === JSON.stringify(sortedActionable) ? prev : sortedActionable);
      setInboxMessages((prev) => JSON.stringify(prev) === JSON.stringify(sortedHistory) ? prev : sortedHistory);
    } catch (e) {}
  }, [address, hasWallet]);

  useEffect(() => {
    if (hasWallet) { fetchPendingPayments(); const interval = setInterval(() => fetchPendingPayments(), 5000); return () => clearInterval(interval); }
  }, [hasWallet, fetchPendingPayments]);

  const handleResolveDispute = async (id: string, winnerAddress: string) => { /* logic */ };

  // THE LOADER: Will never run for more than 800ms
  if (!mounted || !isSettled) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-[#F8F9FA] relative z-50">
        <div className="w-14 h-14 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30 mb-6 animate-pulse">
          <ShieldCheck className="w-8 h-8 text-white" strokeWidth={2.5} />
        </div>
        <div className="flex items-center gap-3 text-indigo-900 font-bold text-xs tracking-widest uppercase">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
          Initializing Protocol
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#F8F9FA] font-sans text-slate-900 overflow-x-hidden relative selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* ARCHITECTURAL GRID */}
      <div className="fixed inset-0 pointer-events-none z-0 flex justify-center overflow-hidden">
        <div className="absolute inset-0 opacity-[0.5]" style={{ backgroundImage: 'linear-gradient(to right, rgba(79, 70, 229, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(79, 70, 229, 0.05) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px]" />
      </div>

      {/* BRANDED FEEDBACK TAB - NOW VISIBLE ON ALL SCREENS */}
      <div className="flex fixed right-0 top-1/2 -translate-y-1/2 z-[60]">
        <button onClick={() => setIsFeedbackOpen(true)} className="bg-indigo-600 text-white hover:bg-indigo-700 py-3 px-1.5 sm:py-4 sm:px-2 rounded-l-lg shadow-md shadow-indigo-600/20 border border-r-0 border-indigo-700 transition-colors flex flex-col items-center gap-2">
          <MessageSquareQuote size={12} className="sm:w-[14px] sm:h-[14px] text-indigo-50" />
          <span className="[writing-mode:vertical-lr] font-bold tracking-widest text-[8px] sm:text-[9px] rotate-180 uppercase mt-0.5 text-white">Feedback</span>
        </button>
      </div>

      {/* FEEDBACK MODAL */}
      {isFeedbackOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-sm bg-white border border-slate-200 rounded-xl shadow-2xl p-6">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2"><MessageSquareQuote className="text-indigo-600" size={16} /> Submit Feedback</h2>
              <button onClick={() => setIsFeedbackOpen(false)} className="text-slate-400 hover:text-slate-900 transition-colors bg-slate-50 p-1.5 rounded-md"><X size={14} /></button>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Type</label>
                <div className="flex gap-2">
                  {['Bug', 'Feature', 'General'].map(type => (
                    <button key={type} onClick={() => setFeedbackType(type)} className={`flex-1 py-2 rounded-md text-xs font-bold transition-all border ${feedbackType === type ? 'bg-indigo-50 text-indigo-700 border-indigo-300 shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Message</label>
                <textarea rows={4} placeholder="Describe your experience..." value={feedbackMsg} onChange={(e) => setFeedbackMsg(e.target.value)} className="w-full bg-white border border-slate-200 rounded-md p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all resize-none shadow-inner"/>
              </div>

              <button onClick={handleFeedbackSubmit} disabled={isSubmittingFeedback || !feedbackMsg.trim()} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-bold text-xs transition-all shadow-md shadow-indigo-600/20 active:scale-95 flex justify-center items-center gap-2">
                {isSubmittingFeedback ? <Loader2 className="animate-spin" size={14} /> : 'Send Feedback'}
              </button>
            </div>
          </div>
        </div>
      )}

      {slashPayment && <SlashWarningModal isOpen={true} onClose={() => { setSlashPayment(null); setTimeout(() => fetchPendingPayments(), 500); }} paymentId={slashPayment.id} totalPoolUsdc={((Number(slashPayment.amount) + Number(slashPayment.bondAmount)) / 1e6).toFixed(2)} />}
      <ArbiterConfirmModal isOpen={!!arbiterAction} onClose={() => setArbiterAction(null)} onConfirm={handleResolveDispute} actionData={arbiterAction} />
      
      {/* PASSING hasWallet DOWN TO HEADER */}
      <Header address={address} hasWallet={hasWallet} notifications={pendingPayments} inbox={inboxMessages} usdcBalance={formattedBalance} />

      {/* DYNAMIC MAIN WRAPPER */}
      <main className={`flex-1 flex flex-col items-center px-4 sm:px-6 w-full mx-auto relative z-10 ${!hasWallet ? 'justify-center py-10 sm:py-16 max-w-5xl' : 'py-8 sm:py-12 max-w-4xl'}`}>
        {!hasWallet ? (
          
          <div className="w-full flex flex-col items-center space-y-10 sm:space-y-14 animate-fade-in">
            
            {/* SPLIT COLOR HERO TEXT */}
            <div className="text-center space-y-4 sm:space-y-5 px-2 relative z-10">
              <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tighter leading-[1.05]">
                <span className="text-slate-900">Trustless Payments.</span><br/>
                <span className="text-indigo-600">Settled Instantly.</span>
              </h1>
              <p className="text-sm sm:text-lg text-slate-600 max-w-2xl mx-auto font-medium leading-relaxed">
                The enterprise escrow protocol. Secure any transaction with conditional logic, arbiters, and cryptographic bonds.
              </p>
            </div>

            {/* BRANDED CARDS */}
            <div className="flex flex-col md:flex-row items-center md:items-stretch justify-center gap-4 sm:gap-6 w-full relative z-10 pt-2">
              <div className="group w-full md:w-auto p-5 sm:p-6 rounded-xl bg-white border border-slate-200 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-md hover:border-indigo-200 transition-all flex-1 flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-3 sm:mb-4 group-hover:scale-105 transition-transform"><Lock size={20} /></div>
                <h3 className="font-bold text-sm sm:text-base text-slate-900 mb-1.5">1. Lock Assets</h3>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">Sender deposits USDC into the non-custodial contract. Funds are secured on-chain.</p>
              </div>

              <div className="hidden md:flex items-center text-indigo-200"><ChevronsRight size={20} /></div>
              <div className="flex md:hidden items-center text-indigo-200"><ChevronsDown size={20} /></div>

              <div className="group w-full md:w-auto p-5 sm:p-6 rounded-xl bg-white border border-slate-200 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-md hover:border-indigo-200 transition-all flex-1 flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-3 sm:mb-4 group-hover:scale-105 transition-transform"><Code2 size={20} /></div>
                <h3 className="font-bold text-sm sm:text-base text-slate-900 mb-1.5">2. Define Logic</h3>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">Set precise conditions for release: expiry dates, arbiters, or performance bonds.</p>
              </div>

              <div className="hidden md:flex items-center text-indigo-200"><ChevronsRight size={20} /></div>
              <div className="flex md:hidden items-center text-indigo-200"><ChevronsDown size={20} /></div>

              <div className="group w-full md:w-auto p-5 sm:p-6 rounded-xl bg-white border border-slate-200 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-md hover:border-indigo-200 transition-all flex-1 flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-3 sm:mb-4 group-hover:scale-105 transition-transform"><CheckCircle2 size={20} /></div>
                <h3 className="font-bold text-sm sm:text-base text-slate-900 mb-1.5">3. Execute</h3>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">When conditions are met, the contract autonomously releases funds. Zero trust required.</p>
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
          /* DASHBOARD (CONNECTED) */
          <div className="animate-fade-in w-full flex flex-col items-center gap-6">
            
            {/* FULL WIDTH SEGMENTED CONTROL */}
            <div className="flex justify-center p-1.5 bg-white border border-slate-200 rounded-lg shadow-sm w-full max-w-md">
              <TabButton active={activeTab === 'create'} onClick={() => setActiveTab('create')} icon={PlusCircle} label="New Escrow" />
              <TabButton active={activeTab === 'activity'} onClick={() => setActiveTab('activity')} icon={ActivityIcon} label="Activity" />
            </div>
            
            <div className="w-full flex justify-center min-h-[400px]">
              {activeTab === 'create' ? (
                /* PRECISION FORM CONTAINER */
                <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
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

      {/* MOBILE-OPTIMIZED COMPACT FOOTER */}
      <footer className="w-full py-5 px-3 border-t border-slate-200/50 bg-transparent flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6 text-[8px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-widest z-20">
        <span className="cursor-default shrink-0">© 2026 Custodex</span>
        <div className="flex flex-wrap justify-center items-center gap-1.5 sm:gap-4">
          <a href="https://faucet.circle.com/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800 transition-colors underline decoration-indigo-200 hover:decoration-indigo-400 underline-offset-2 sm:underline-offset-4">USDC Faucet</a>
          <span className="text-slate-300">•</span>
          <a href="https://testnet.arcscan.app/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800 transition-colors underline decoration-indigo-200 hover:decoration-indigo-400 underline-offset-2 sm:underline-offset-4">Arc Explorer</a>
        </div>
      </footer>

    </div>
  );
}