'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { WagmiProvider, http, useAccount, useReadContract, useDisconnect } from 'wagmi';
import { type Chain } from 'wagmi/chains';
import { RainbowKitProvider, getDefaultConfig, lightTheme, darkTheme, ConnectButton } from '@rainbow-me/rainbowkit';
import { metaMaskWallet, okxWallet, trustWallet, rabbyWallet, phantomWallet, bitgetWallet, safepalWallet, coinbaseWallet, rainbowWallet, walletConnectWallet } from '@rainbow-me/rainbowkit/wallets';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTheme } from 'next-themes';
import { formatUnits } from 'viem';

import EscrowForm from './EscrowForm';
import ActivityList from './ActivityList';
import Guide from './Guide';
import Profile from './Profile';
import Quests from './Quests';
import Leaderboard from './Leaderboard';
import FeedbackForm from './FeedbackForm';
import ThemeToggle from './ThemeToggle';
import ProfileAvatar from './ProfileAvatar';
import { USDC_ADDRESS, ERC20_ABI } from './constants';
import { useToast, ToastProvider } from './Toast';
import { supabase } from './supabaseClient';
import {
  ShieldCheck, Bell, Activity as ActivityIcon, CheckCircle2, Clock, PlusCircle, X, Mail, CheckCircle, XCircle, ChevronRight, ChevronsRight, ChevronsDown, Lock, Code2, Loader2, Wallet, Flame, Undo2, Copy, Check, BookOpen, Award, UserCircle, ChevronLeft, LogOut
} from 'lucide-react';

const arcTestnet: Chain = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
  rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } },
  blockExplorers: { default: { name: 'Arc Explorer', url: 'https://testnet.arcscan.app' } },
  testnet: true,
};

const config = getDefaultConfig({
  appName: 'Custodex',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? 'YOUR_PROJECT_ID',
  chains: [arcTestnet],
  transports: {
    [arcTestnet.id]: http('https://rpc.testnet.arc.network', { timeout: 5000 }),
  },
  ssr: true,
  wallets: [
    {
      groupName: 'Popular DApp Browsers',
      wallets: [ okxWallet, metaMaskWallet, trustWallet, rabbyWallet, phantomWallet, bitgetWallet, safepalWallet, coinbaseWallet ],
    },
    {
      groupName: 'Fallback (May be slow on mobile data)',
      wallets: [ rainbowWallet, walletConnectWallet ],
    },
  ],
});

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000, retry: 1, refetchOnWindowFocus: false } },
});

export function Providers({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => { setMounted(true); }, []);

  const appLightTheme = lightTheme({ accentColor: '#4f46e5', borderRadius: 'large' });
  const appDarkTheme = darkTheme({ accentColor: '#4f46e5', borderRadius: 'large' });

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={mounted && resolvedTheme === 'dark' ? appDarkTheme : appLightTheme} initialChain={arcTestnet}>
          <ToastProvider>
            {children}
          </ToastProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

interface Payment {
  id: string; sender: string; receiver: string; arbiter: string; token: string;
  amount: bigint; bondAmount: bigint; deadline: bigint; availableAt: bigint; 
  acceptedAt: bigint; termsHash: string; pType: number; status: number;
  resolvedTo: string; isDeclined?: boolean; hasVerdict?: boolean; lastTxHash?: string;
}

const truncateAddress = (addr: string) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';

const getEscrowTypeName = (pType: number) => {
  if (pType === 1) return 'Timelocked';
  if (pType === 2) return 'Mediated';
  if (pType === 3) return 'Bonded';
  return 'Basic';
};

const Header = ({ address, hasWallet, notifications = [], inbox = [], usdcBalance, onNavigate, activeTab, userStats }: any) => {
  const { disconnect } = useDisconnect();
  const [isBellOpen, setIsBellOpen] = useState(false);
  const [isInboxOpen, setIsInboxOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  
  const [readMessages, setReadMessages] = useState<Set<string>>(new Set());
  const [expandedMsg, setExpandedMsg] = useState<string | null>(null);
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  useEffect(() => {
    const interval = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTimeRemaining = (targetTime: number) => {
    const remaining = targetTime - now;
    if (remaining <= 0) return 'Expired';
    const hrs = Math.floor(remaining / 3600); const mins = Math.floor((remaining % 3600) / 60);
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m ${remaining % 60}s`;
  };

  useEffect(() => {
    if (address) {
      const fetchReadState = async () => {
        const { data } = await supabase.from('user_read_state').select('read_items').eq('wallet_address', address.toLowerCase()).single();
        if (data?.read_items) setReadMessages(new Set(data.read_items));
        else setReadMessages(new Set());
      };
      fetchReadState();
    }
  }, [address]);

  const markAllAsRead = () => {
    setReadMessages((prev) => {
      const next = new Set(prev);
      inbox.forEach((m: any) => next.add(`${m.id}-${m.status}`));
      if (address) supabase.from('user_read_state').upsert({ wallet_address: address.toLowerCase(), read_items: Array.from(next) }).then();
      return next;
    });
  };

  const toggleMsgExpand = (id: string, status: number) => {
    const notifId = `${id}-${status}`;
    setExpandedMsg(expandedMsg === id ? null : id);
    setReadMessages((prev) => {
      const next = new Set(prev);
      next.add(notifId);
      if (address) supabase.from('user_read_state').upsert({ wallet_address: address.toLowerCase(), read_items: Array.from(next) }).then();
      return next;
    });
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) { 
        setIsBellOpen(false); setIsInboxOpen(false); 
      }
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setIsProfileDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = inbox.filter((m: any) => !readMessages.has(`${m.id}-${m.status}`)).length;
  const visibleNotifications = notifications.filter((n: any) => {
    const isReceiver = address && n.receiver.toLowerCase() === address.toLowerCase();
    const isExpired = (Math.floor(Date.now() / 1000)) > Number(n.deadline) && Number(n.deadline) !== 0;
    return !(isExpired && isReceiver);
  });

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-950/70 backdrop-blur-xl h-16 sm:h-20 shrink-0 w-full flex items-center shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
      <div className="w-full px-3 sm:px-6 lg:px-8 h-full flex items-center justify-between max-w-7xl mx-auto gap-2">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-md bg-indigo-600 flex items-center justify-center shadow-sm shadow-indigo-600/30"><ShieldCheck className="w-4 h-4 text-white" strokeWidth={2.5} /></div>
          <span className="font-bold text-lg sm:text-xl tracking-tight text-indigo-950 dark:text-indigo-50">Custodex</span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-4">
          <ThemeToggle />
          
          {hasWallet && (
            <>
              <div className="hidden sm:flex bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-lg items-center gap-2 shadow-sm">
                <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest">USDC</span>
                <span className="text-xs font-mono text-slate-900 dark:text-slate-100 font-semibold">{usdcBalance === 'loading' ? '...' : usdcBalance}</span>
              </div>
              
              <div className="relative flex gap-1 sm:gap-2" ref={dropdownRef}>
                <button type="button" onClick={() => { setIsInboxOpen(!isInboxOpen); setIsBellOpen(false); setIsProfileDropdownOpen(false); }} className={`p-1.5 sm:p-2 rounded-lg transition-all relative border ${isInboxOpen ? 'bg-indigo-100 dark:bg-indigo-500/20 border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300' : 'bg-indigo-50 dark:bg-slate-900 border-indigo-100 dark:border-slate-800 text-indigo-600 dark:text-indigo-400'}`}>
                  <Mail className="w-4 h-4" />
                  {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" />}
                </button>

                <button type="button" onClick={() => { setIsBellOpen(!isBellOpen); setIsInboxOpen(false); setIsProfileDropdownOpen(false); }} className={`p-1.5 sm:p-2 rounded-lg transition-all relative border ${isBellOpen ? 'bg-indigo-100 dark:bg-indigo-500/20 border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300' : 'bg-indigo-50 dark:bg-slate-900 border-indigo-100 dark:border-slate-800 text-indigo-600 dark:text-indigo-400'}`}>
                  <Bell className="w-4 h-4" />
                  {visibleNotifications.length > 0 && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" />}
                </button>

                {isInboxOpen && (
                  <div className="fixed sm:absolute top-[70px] sm:top-auto sm:mt-12 right-2 sm:right-0 left-2 sm:left-auto sm:w-[360px] max-w-[360px] rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl z-50">
                    <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/50 flex justify-between items-center">
                      <h3 className="font-bold text-slate-900 dark:text-slate-100 text-xs tracking-wider uppercase">Inbox</h3>
                      <div className="flex gap-3 items-center">
                        {inbox.length > 0 && <button type="button" onClick={markAllAsRead} className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 uppercase hover:underline">Mark All As Read</button>}
                        <button type="button" onClick={() => setIsInboxOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X size={14} /></button>
                      </div>
                    </div>
                    <div className="max-h-[350px] overflow-y-auto">
                      {inbox.length === 0 ? <div className="p-6 text-center text-slate-500 text-xs">No messages</div> : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                          {inbox.map((msg: any) => {
                            const notifId = `${msg.id}-${msg.status}`;
                            const isRead = readMessages.has(notifId);
                            const isExpanded = expandedMsg === msg.id;
                            
                            const formatAmount = (Number(msg.amount) / 1e6).toFixed(2);
                            const isMeSender = address && msg.sender.toLowerCase() === address.toLowerCase();
                            const isMeReceiver = address && msg.receiver.toLowerCase() === address.toLowerCase();
                            const senderAddress = truncateAddress(msg.sender);
                            const receiverAddress = truncateAddress(msg.receiver);
                            const isSlashed = msg.pType === 3 && msg.status === 3 && msg.resolvedTo === "0x0000000000000000000000000000000000000000";
                            const typeStr = getEscrowTypeName(msg.pType);

                            let title = "Update"; let desc = "Details in Activity."; let Icon = CheckCircle; let color = 'text-slate-600 dark:text-slate-400';

                            if (msg.isDeclined) { 
                              title = 'Escrow Declined'; 
                              Icon = XCircle; color = 'text-rose-500'; 
                              desc = isMeSender 
                                ? `The receiver (${receiverAddress}) actively declined your escrow offer. The ${formatAmount} USDC has been returned to your wallet.`
                                : `You successfully declined the escrow offer from ${senderAddress}. The ${formatAmount} USDC was returned to them.`;
                            } else if (msg.status === 4) { 
                              title = 'Escrow Reclaimed'; 
                              Icon = Undo2; color = 'text-amber-500'; 
                              desc = isMeSender
                                ? `You successfully reclaimed your ${formatAmount} USDC from ${receiverAddress} after the deadline expired without action.`
                                : `The sender (${senderAddress}) reclaimed the ${formatAmount} USDC because the deadline window passed without any action from your end.`;
                            } else if (isSlashed) { 
                              title = 'Bonded Payment Slashed'; 
                              Icon = Flame; color = 'text-rose-500'; 
                              desc = `A dispute resolution resulted in the ${formatAmount} USDC payment and the posted bond being permanently burned.`;
                            } else if (msg.status === 3) { 
                              title = `${typeStr} Escrow Completed`; 
                              color = 'text-emerald-600'; 
                              desc = isMeReceiver
                                ? `Success! The ${formatAmount} USDC escrow has been completed and the funds are now available in your wallet.`
                                : `The ${formatAmount} USDC escrow was completed successfully and the funds have been released to the receiver (${receiverAddress}).`;
                            } else if (msg.status === 0 && (now > Number(msg.deadline) && Number(msg.deadline) !== 0)) { 
                              title = 'Offer Expired'; 
                              Icon = Clock; color = 'text-slate-500'; 
                              desc = isMeSender
                                ? `The deadline for your ${formatAmount} USDC escrow has passed. You can now reclaim the funds from your Activity dashboard.`
                                : `The deadline for the ${formatAmount} USDC escrow from ${senderAddress} has expired.`;
                            }

                            return (
                              <div key={notifId} className={`p-4 transition-colors cursor-pointer ${isRead ? 'opacity-80 hover:bg-slate-50 dark:hover:bg-slate-800/50' : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800'}`} onClick={() => toggleMsgExpand(msg.id, msg.status)}>
                                <div className="flex gap-3 items-start">
                                  <div className="w-2 flex-shrink-0 flex justify-center pt-1.5">{!isRead && <div className="w-2 h-2 rounded-full bg-indigo-500" />}</div>
                                  <Icon size={16} className={`${color} shrink-0 mt-0.5`} />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center mb-1">
                                      <p className={`text-xs font-bold ${isRead ? 'text-slate-700 dark:text-slate-300' : 'text-slate-900 dark:text-slate-100'}`}>{title}</p>
                                      <ChevronRight size={14} className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                    </div>
                                    {!isExpanded ? (
                                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{desc}</p>
                                    ) : (
                                      <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 animate-fade-in">
                                        <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{desc}</p>
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

                {isBellOpen && (
                  <div className="fixed sm:absolute top-[70px] sm:top-auto sm:mt-12 right-2 sm:right-0 left-2 sm:left-auto sm:w-[340px] max-w-[340px] rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl z-50">
                    <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/50 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 dark:text-slate-100 text-xs tracking-wider uppercase">Actions</h3>
                        <span className="bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 py-0.5 px-1.5 rounded text-[9px] font-bold">{visibleNotifications.length}</span>
                      </div>
                      <button type="button" onClick={() => setIsBellOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X size={14} /></button>
                    </div>
                    <div className="max-h-[350px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/50">
                      {visibleNotifications.length === 0 ? <div className="p-6 text-center text-slate-500 text-xs">No pending actions</div> : visibleNotifications.map((n: any) => {
                        const isSender = address && n.sender.toLowerCase() === address.toLowerCase();
                        const isReceiver = address && n.receiver.toLowerCase() === address.toLowerCase();
                        const isExpired = now > Number(n.deadline) && Number(n.deadline) !== 0;
                        const isCoolingOff = now < Number(n.availableAt);
                        
                        let badgeText = "Action Required";
                        let badgeColor = "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-500/20";

                        if (isExpired && isSender) {
                          badgeText = "Ready to Reclaim";
                          badgeColor = "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-500/20";
                        } else if (n.status === 0) {
                          if (isSender) {
                            badgeText = "Awaiting Receiver";
                          } else if (isReceiver) {
                            if (n.pType === 1 && isCoolingOff) {
                              badgeText = `Unlocks in ${formatTimeRemaining(Number(n.availableAt))}`;
                              badgeColor = "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700";
                          } else if (Number(n.pType) === 3 || Number(n.pType) === 2) { 
                          // ^^^ THIS IS THE ONLY CHANGE! It now catches both Bonded and Mediated
                              badgeText = "Action Required";
                              badgeColor = "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-500/20";
                          } else {
                              badgeText = `Expires in ${formatTimeRemaining(Number(n.deadline))}`;
                              badgeColor = "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-500/20";
                         }
                        }

                        } else if (n.status === 1) {
                          badgeText = "In Progress";
                          badgeColor = "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20";
                        } else if (n.status === 2) {
                          badgeText = "Under Arbitration";
                          badgeColor = "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-500/20";
                        }

                        return (
                          <div key={n.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase ${badgeColor}`}>{badgeText}</span>
                            <div className="mt-3 flex justify-between items-center text-xs">
                              <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">{(Number(n.amount) / 1e6).toFixed(2)} USDC</span>
                              <button type="button" onClick={() => { setIsBellOpen(false); onNavigate?.('activity'); }} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 transition-colors text-white rounded-lg text-[10px] font-bold">Review</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          <div className="flex items-center">
            <ConnectButton.Custom>
              {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
                const connected = mounted && account && chain && hasWallet;
                return (
                  <div style={{ transition: 'opacity 0.2s', opacity: mounted ? 1 : 0, pointerEvents: mounted ? 'auto' : 'none' }}>
                    {(() => {
                      if (!connected) return <button onClick={openConnectModal} type="button" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 px-3 sm:py-2.5 sm:px-4 rounded-lg transition-all shadow-md text-[11px] sm:text-xs touch-manipulation">Connect Wallet</button>;
                      if (chain.unsupported) return <button onClick={openChainModal} type="button" className="bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 font-bold py-1.5 px-3 sm:py-2 sm:px-4 rounded-lg text-[11px] sm:text-xs touch-manipulation">Wrong network</button>;
                      return (
                        <div className="flex items-center gap-1.5 relative" ref={profileDropdownRef}>
                          <button onClick={openChainModal} type="button" className="hidden md:flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 py-1.5 px-2.5 rounded-lg shadow-sm">
                            {chain.hasIcon && <div style={{ background: chain.iconBackground, width: 16, height: 16, borderRadius: 999, overflow: 'hidden', marginRight: 6 }}>{chain.iconUrl && <img alt={chain.name ?? 'Chain icon'} src={chain.iconUrl} style={{ width: 16, height: 16 }} />}</div>}
                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{chain.name}</span>
                          </button>
                          
                          <button onClick={() => { setIsProfileDropdownOpen(!isProfileDropdownOpen); setIsBellOpen(false); setIsInboxOpen(false); }} type="button" className={`p-1 sm:p-1.5 rounded-lg transition-all border flex items-center gap-1.5 ${isProfileDropdownOpen || ['profile', 'quests', 'leaderboard'].includes(activeTab) ? 'bg-indigo-600 text-white shadow-md border-indigo-700' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-indigo-600 dark:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-slate-100 dark:bg-slate-800 pointer-events-none">
                              <div className="w-[100px] h-[100px] flex items-center justify-center shrink-0 origin-center scale-[0.20] sm:scale-[0.24]">
                                <ProfileAvatar />
                              </div>
                            </div>
                            {userStats?.username && <span className="text-[10px] font-bold hidden sm:block pr-1 sm:pr-2 truncate max-w-[80px]">{userStats.username}</span>}
                          </button>

                          {isProfileDropdownOpen && (
                            <div className="absolute top-[120%] right-0 w-48 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl z-50 overflow-hidden animate-fade-in">
                              <div className="p-2 flex flex-col gap-1">
                                <button onClick={() => { onNavigate('profile'); setIsProfileDropdownOpen(false); }} className="px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors w-full text-left">Profile</button>
                                <button onClick={() => { onNavigate('quests'); setIsProfileDropdownOpen(false); }} className="px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors w-full text-left">Quests</button>
                                <button onClick={() => { onNavigate('leaderboard'); setIsProfileDropdownOpen(false); }} className="px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors w-full text-left">Leaderboard</button>
                              </div>
                              <div className="border-t border-slate-100 dark:border-slate-800 p-2">
                                <button onClick={() => { disconnect(); setIsProfileDropdownOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors"><LogOut size={14} /> Disconnect Wallet</button>
                              </div>
                            </div>
                          )}
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

const TabButton = ({ active, onClick, icon: Icon, label }: any) => (
  <button onClick={onClick} className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 sm:px-4 rounded-md text-[11px] sm:text-xs font-bold tracking-wide transition-all duration-200 ${active ? 'bg-indigo-600 text-white shadow-sm border border-indigo-700' : 'text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 border border-transparent'}`}>
    <Icon size={14} className="hidden sm:block shrink-0" /> <span className="truncate">{label}</span>
  </button>
);

export default function Home() {
  const { address, status } = useAccount();
  const { showToast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState('create');
  
  const [pendingPayments, setPendingPayments] = useState<Payment[]>([]);
  const [inboxMessages, setInboxMessages] = useState<Payment[]>([]); 
  
  const [userStats, setUserStats] = useState<{ 
    xp: number, streak: number, lastCheckin: string | null, username: string | null, avatarId: number, 
    completedQuests: string[], readGuides: number[], discordConnected: boolean, discordUsername?: string,
    telegramConnected: boolean, telegramUsername?: string,
    twitterConnected: boolean, twitterUsername?: string
  }>({ 
    xp: 0, streak: 0, lastCheckin: null, username: null, avatarId: 0, completedQuests: [], readGuides: [], 
    discordConnected: false, telegramConnected: false, twitterConnected: false
  });

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
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const hash = window.location.hash;
      
      if (searchParams.get('tab') === 'profile' || hash.includes('access_token')) {
        setActiveTab('profile'); 
        const cleanUrl = window.location.pathname + hash;
        window.history.replaceState(null, '', cleanUrl);
      }
    }
  }, []);

  const fetchUserStats = useCallback(async () => {
    if (address) {
      const { data } = await supabase.from('user_points').select('*').eq('wallet_address', address.toLowerCase()).single();
      
      let quests = data?.completed_quests || [];
      let currentXp = data?.xp || 0;
      let currentUsername = data?.username;
      let needsUpdate = false;

      if (!currentUsername) { currentUsername = `User_${address.slice(-4)}`; needsUpdate = true; }
      if (!quests.includes('connect_wallet')) { quests = [...quests, 'connect_wallet']; currentXp += 50; needsUpdate = true; }

      setUserStats({ 
        xp: currentXp, 
        streak: data?.current_streak || 0, 
        lastCheckin: data?.last_checkin, 
        username: currentUsername, 
        avatarId: data?.avatar_id || 0, 
        completedQuests: quests,
        readGuides: data?.read_guides || [],
        discordConnected: data?.discord_connected || false,
        discordUsername: data?.discord_username,
        telegramConnected: data?.telegram_connected || false,
        telegramUsername: data?.telegram_username,
        twitterConnected: data?.twitter_connected || false,
        twitterUsername: data?.twitter_username
      });

      if (needsUpdate) {
        await supabase.from('user_points').upsert({ wallet_address: address.toLowerCase(), username: currentUsername, xp: currentXp, completed_quests: quests, avatar_id: data?.avatar_id || 0 });
      }
    }
  }, [address]);

  useEffect(() => {
    fetchUserStats();
    window.addEventListener('xp-updated', fetchUserStats);
    return () => window.removeEventListener('xp-updated', fetchUserStats);
  }, [fetchUserStats]);

  const processQuestClaim = async (baseQuestId: string, xpReward: number, isDaily: boolean = false) => {
    if (!address) return false;
    try {
      const today = new Date().toISOString().split('T')[0];
      const questId = isDaily ? `${baseQuestId}_${today}` : baseQuestId;

      const { data } = await supabase.from('user_points').select('xp, completed_quests').eq('wallet_address', address.toLowerCase()).single();
      const currentQuests = data?.completed_quests || [];
      const currentXp = data?.xp || 0;

      if (currentQuests.includes(questId)) return false;

      const newQuests = [...currentQuests, questId];
      const newXp = currentXp + xpReward;

      await supabase.from('user_points').upsert({
        wallet_address: address.toLowerCase(),
        xp: newXp,
        completed_quests: newQuests
      });

      await fetchUserStats();
      return true;
    } catch (e) {
      showToast('error', 'Failed to claim XP');
      return false;
    }
  };

  const fetchPendingPayments = useCallback(async () => {
    if (!address) return;
    try {
      const userAddr = address.toLowerCase();
      const [paymentsRes, verdictsRes] = await Promise.all([
          supabase.from('escrow_payments').select('*').or(`sender.eq.${userAddr},receiver.eq.${userAddr},arbiter.eq.${userAddr}`),
          supabase.from('arbiter_chat').select('payment_id').ilike('message', 'VERDICT RENDERED%')
      ]);
      const verdictSet = new Set(verdictsRes.data?.map(v => String(v.payment_id)) || []);

      if (paymentsRes.data) {
        const actionable: any[] = []; const history: any[] = [];
        const sorted = paymentsRes.data.sort((a: any, b: any) => Number(b.id) - Number(a.id));
        
        sorted.forEach((d: any) => {
          const p = { 
            ...d, 
            pType: d.p_type, 
            bondAmount: d.bond_amount, 
            availableAt: d.available_at, 
            isDeclined: d.is_declined, 
            resolvedTo: d.resolved_to, 
            hasVerdict: verdictSet.has(String(d.id)),
            lastTxHash: d.last_tx_hash
          };
          if (d.is_declined || d.status === 3 || d.status === 4) history.push(p);
          else actionable.push(p);
        });
        setPendingPayments((prev) => JSON.stringify(prev) === JSON.stringify(actionable) ? prev : actionable);
        setInboxMessages((prev) => JSON.stringify(prev) === JSON.stringify(history) ? prev : history);
      }
    } catch (e) { console.warn("Background sync delayed"); }
  }, [address]);

  useEffect(() => {
    if (address && status === 'connected') {
      fetchPendingPayments();
      const interval = setInterval(fetchPendingPayments, 15000);
      return () => clearInterval(interval);
    }
  }, [address, status, fetchPendingPayments]);

  const isAuthLoading = !mounted || status === 'connecting' || status === 'reconnecting';

  if (isAuthLoading) return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center relative z-50">
      <div className="w-14 h-14 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30 mb-6 animate-pulse"><ShieldCheck className="w-8 h-8 text-white" strokeWidth={2.5} /></div>
      <div className="flex items-center gap-3 text-indigo-900 dark:text-indigo-100 font-bold text-xs tracking-widest uppercase"><Loader2 className="w-4 h-4 animate-spin text-indigo-600 dark:text-indigo-400" />Initializing Protocol</div>
    </div>
  );

  const hasWallet = !!address && status === 'connected';

  return (
    <div className="min-h-[100dvh] flex flex-col font-sans overflow-x-hidden relative selection:bg-indigo-100 dark:selection:bg-indigo-900 selection:text-indigo-900 dark:selection:text-indigo-100">
      <div className="fixed inset-0 pointer-events-none z-0 flex justify-center overflow-hidden">
        <div className="absolute inset-0 dark:hidden opacity-[0.5]" style={{ backgroundImage: 'linear-gradient(to right, rgba(79, 70, 229, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(79, 70, 229, 0.05) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="absolute inset-0 hidden dark:block opacity-[0.25]" style={{ backgroundImage: 'linear-gradient(to right, rgba(99, 102, 241, 0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(99, 102, 241, 0.2) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-indigo-500/10 dark:bg-indigo-500/30 rounded-full blur-[120px]" />
      </div>

      <Header address={address} hasWallet={hasWallet} notifications={pendingPayments} inbox={inboxMessages} usdcBalance={formattedBalance} userStats={userStats} activeTab={activeTab} onNavigate={setActiveTab} />

      <main className={`flex-1 flex flex-col items-center px-4 sm:px-6 w-full mx-auto relative z-10 ${!hasWallet ? 'justify-center py-8 sm:py-12 max-w-4xl' : 'py-4 sm:py-6 max-w-2xl'}`}>
        {!hasWallet ? (
          <div className="w-full flex flex-col items-center space-y-10 sm:space-y-14 animate-fade-in">
            <div className="text-center space-y-4 sm:space-y-5 px-2 relative z-10">
              <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tighter leading-[1.05]"><span className="text-slate-900 dark:text-slate-100">Trustless Payments.</span><br/><span className="text-indigo-600 dark:text-indigo-400">Settled Instantly.</span></h1>
              <p className="text-sm sm:text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto font-medium leading-relaxed">The enterprise escrow protocol. Secure any transaction with conditional logic, arbiters, and cryptographic bonds.</p>
            </div>

            <div className="flex flex-col md:flex-row items-center md:items-stretch justify-center gap-4 sm:gap-6 w-full relative z-10 pt-2">
              <div className="group w-full md:w-auto p-5 sm:p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-none hover:shadow-md dark:hover:border-indigo-500/50 transition-all flex-1 flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-3 sm:mb-4 group-hover:scale-105 transition-transform"><Lock size={20} /></div>
                <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100 mb-1.5">1. Lock Assets</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">Sender deposits USDC into the non-custodial contract. Funds are secured on-chain.</p>
              </div>
              <div className="hidden md:flex items-center text-indigo-200 dark:text-slate-700"><ChevronsRight size={20} /></div>
              <div className="flex md:hidden items-center text-indigo-200 dark:text-slate-700"><ChevronsDown size={20} /></div>
              <div className="group w-full md:w-auto p-5 sm:p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-none hover:shadow-md dark:hover:border-indigo-500/50 transition-all flex-1 flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-3 sm:mb-4 group-hover:scale-105 transition-transform"><Code2 size={20} /></div>
                <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100 mb-1.5">2. Define Logic</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">Set precise conditions for release: expiry dates, arbiters, or performance bonds.</p>
              </div>
              <div className="hidden md:flex items-center text-indigo-200 dark:text-slate-700"><ChevronsRight size={20} /></div>
              <div className="flex md:hidden items-center text-indigo-200 dark:text-slate-700"><ChevronsDown size={20} /></div>
              <div className="group w-full md:w-auto p-5 sm:p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-none hover:shadow-md dark:hover:border-indigo-500/50 transition-all flex-1 flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-3 sm:mb-4 group-hover:scale-105 transition-transform"><CheckCircle2 size={20} /></div>
                <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100 mb-1.5">3. Execute</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">When conditions are met, the contract autonomously releases funds. Zero trust required.</p>
              </div>
            </div>
            
            <div className="pt-2 pb-6 flex flex-col items-center w-full relative z-10">
              <ConnectButton.Custom>
                {({ openConnectModal }) => (
                  <div style={{ transition: 'opacity 0.2s', opacity: mounted ? 1 : 0, pointerEvents: mounted ? 'auto' : 'none' }}>
                    <button onClick={openConnectModal} type="button" className="px-8 py-3.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg font-bold text-sm tracking-wide shadow-md flex items-center gap-2 touch-manipulation">
                      Launch Platform <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </ConnectButton.Custom>
            </div>
          </div>
        ) : (
          <div className="animate-fade-in w-full flex flex-col items-center gap-4">
            {['profile', 'quests', 'leaderboard'].includes(activeTab) ? (
              <div className="w-full flex flex-col">
                <div className="w-full flex justify-start mb-2">
                  <button onClick={() => setActiveTab('create')} className="text-xs font-bold text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 transition-colors px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                    <ChevronLeft size={14} /> Back to Dashboard
                  </button>
                </div>
                {activeTab === 'profile' && <Profile userStats={userStats} fetchUserStats={fetchUserStats} />}
                {activeTab === 'quests' && <Quests userStats={userStats} fetchUserStats={fetchUserStats} processQuestClaim={processQuestClaim} />}
                {activeTab === 'leaderboard' && <Leaderboard userStats={userStats} />}
              </div>
            ) : (
              <>
                <div className={`flex justify-center p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm w-full mb-2 transition-all duration-300 ${
                  activeTab === 'create' ? 'max-w-md' : 
                  activeTab === 'activity' ? 'max-w-2xl' : 
                  'max-w-3xl'
                }`}>
                  <TabButton active={activeTab === 'create'} onClick={() => setActiveTab('create')} icon={PlusCircle} label="New Escrow" />
                  <TabButton active={activeTab === 'activity'} onClick={() => setActiveTab('activity')} icon={ActivityIcon} label="Activity" />
                  <TabButton active={activeTab === 'guide'} onClick={() => setActiveTab('guide')} icon={BookOpen} label="Guide" />
                </div>
                
                <div className="w-full flex justify-center min-h-[400px]">
                  {activeTab === 'create' && (
                    <div className="w-full max-w-md bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)] dark:ring-1 dark:ring-white/5">
                      <EscrowForm onPaymentCreated={() => { 
  setActiveTab('activity');
  fetchPendingPayments(); // ✅ Refresh bell notifications immediately
}} />
                    </div>
                  )}
                  {activeTab === 'activity' && (
                    <div className="w-full max-w-2xl">
                      <ActivityList className="w-full" onActivityUpdate={fetchPendingPayments} />
                    </div>
                  )}
                  {activeTab === 'guide' && (
                    <div className="w-full max-w-3xl">
                      <Guide />
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </main>
      
      <footer className="w-full py-5 px-3 border-t border-slate-200/50 dark:border-slate-800/50 bg-transparent flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6 text-[8px] sm:text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest z-20 mt-auto">
        <span className="cursor-default shrink-0">© 2026 Custodex</span>
        <div className="flex flex-wrap justify-center items-center gap-1.5 sm:gap-4">
          <a href="https://faucet.circle.com/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">USDC Faucet</a>
          <span className="text-slate-300 dark:text-slate-700">•</span>
          <a href="https://testnet.arcscan.app/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">Arc Explorer</a>
        </div>
      </footer>

      {hasWallet && <FeedbackForm />}
    </div>
  );
}