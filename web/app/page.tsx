'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAccount, useWriteContract, useReadContract, useDisconnect } from 'wagmi';
import { formatUnits } from 'viem';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import EscrowForm from './EscrowForm';
import ActivityList from './ActivityList';
import Guide from './Guide';
import Profile from './Profile';
import Quests from './Quests';
import Leaderboard from './Leaderboard';
import ThemeToggle from './ThemeToggle';
import { USDC_ADDRESS, ERC20_ABI, CONTRACT_ADDRESS, CONTRACT_ABI } from './constants';
import { useToast } from './Toast';
import { supabase } from './supabaseClient';
import {
  ShieldCheck, Bell, Activity as ActivityIcon, CheckCircle2, Clock, PlusCircle, X, AlertTriangle, Snowflake, Mail, CheckCircle, XCircle, ChevronRight, ChevronsRight, ChevronsDown, Lock, Code2, MessageSquareQuote, Loader2, Wallet, Flame, ExternalLink, Undo2, Copy, Check, BookOpen, Award, UserCircle, ChevronLeft, LogOut, Trophy, Activity
} from 'lucide-react';

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

  useEffect(() => {
    if (address) {
      const fetchReadState = async () => {
        const { data } = await supabase.from('user_read_state').select('read_items').eq('wallet_address', address.toLowerCase()).single();
        if (data?.read_items) setReadMessages(new Set(data.read_items));
      };
      fetchReadState();
    }
  }, [address]);

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
                      if (!connected) return <button onClick={openConnectModal} type="button" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 px-3 sm:py-2 sm:px-4 rounded-lg transition-all shadow-md active:scale-95 text-[11px] sm:text-xs">Connect Wallet</button>;
                      if (chain.unsupported) return <button onClick={openChainModal} type="button" className="bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 font-bold py-1.5 px-3 sm:py-2 sm:px-4 rounded-lg text-[11px] sm:text-xs">Wrong network</button>;
                      return (
                        <div className="flex items-center gap-1.5 relative" ref={profileDropdownRef}>
                          <button onClick={openChainModal} type="button" className="hidden md:flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 py-1.5 px-2.5 rounded-lg shadow-sm">
                            {chain.hasIcon && <div style={{ background: chain.iconBackground, width: 16, height: 16, borderRadius: 999, overflow: 'hidden', marginRight: 6 }}>{chain.iconUrl && <img alt={chain.name ?? 'Chain icon'} src={chain.iconUrl} style={{ width: 16, height: 16 }} />}</div>}
                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{chain.name}</span>
                          </button>
                          
                          <button onClick={() => { setIsProfileDropdownOpen(!isProfileDropdownOpen); setIsBellOpen(false); setIsInboxOpen(false); }} type="button" className={`p-1.5 sm:p-2 rounded-lg transition-all border flex items-center gap-1.5 ${isProfileDropdownOpen || ['profile', 'quests', 'leaderboard'].includes(activeTab) ? 'bg-indigo-600 text-white shadow-md border-indigo-700' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-indigo-600 dark:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                            <UserCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                            {userStats?.username && <span className="text-[10px] font-bold hidden sm:block pr-1 truncate max-w-[80px]">{userStats.username}</span>}
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
  const [isSettled, setIsSettled] = useState(false);
  const [activeTab, setActiveTab] = useState('create');
  
  const [pendingPayments, setPendingPayments] = useState<Payment[]>([]);
  const [inboxMessages, setInboxMessages] = useState<Payment[]>([]); 
  
  const [userStats, setUserStats] = useState<{ xp: number, streak: number, lastCheckin: string | null, username: string | null, avatarId: number, completedQuests: string[], readGuides: number[], discordConnected: boolean }>({ 
    xp: 0, streak: 0, lastCheckin: null, username: null, avatarId: 0, completedQuests: [], readGuides: [], discordConnected: false 
  });

  const [metrics, setMetrics] = useState({ escrows: 1042, users: 201, volume: 45200 });

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
    if (status === 'connected' || status === 'disconnected') { setIsSettled(true); clearTimeout(failsafeTimer); }
    return () => clearTimeout(failsafeTimer);
  }, [status]);

  useEffect(() => {
    if (address) return; 
    const interval = setInterval(() => {
      setMetrics(prev => ({
        escrows: prev.escrows + (Math.random() > 0.7 ? 1 : 0),
        users: prev.users + (Math.random() > 0.8 ? 1 : 0),
        volume: prev.volume + (Math.random() > 0.5 ? Math.floor(Math.random() * 50) : 0)
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, [address]);

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
        discordConnected: data?.discord_connected || false
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

      showToast('success', `+${xpReward} XP Claimed!`);
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

  if (!mounted || !isSettled) return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center relative z-50">
      <div className="w-14 h-14 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30 mb-6 animate-pulse"><ShieldCheck className="w-8 h-8 text-white" strokeWidth={2.5} /></div>
      <div className="flex items-center gap-3 text-indigo-900 dark:text-indigo-100 font-bold text-xs tracking-widest uppercase"><Loader2 className="w-4 h-4 animate-spin text-indigo-600 dark:text-indigo-400" />Initializing Protocol</div>
    </div>
  );

  const hasWallet = !!address;

  return (
    <div className="min-h-[100dvh] flex flex-col font-sans overflow-x-hidden relative selection:bg-indigo-100 dark:selection:bg-indigo-900 selection:text-indigo-900 dark:selection:text-indigo-100">
      <div className="fixed inset-0 pointer-events-none z-0 flex justify-center overflow-hidden">
        <div className="absolute inset-0 dark:hidden opacity-[0.5]" style={{ backgroundImage: 'linear-gradient(to right, rgba(79, 70, 229, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(79, 70, 229, 0.05) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="absolute inset-0 hidden dark:block opacity-[0.25]" style={{ backgroundImage: 'linear-gradient(to right, rgba(99, 102, 241, 0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(99, 102, 241, 0.2) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-indigo-500/10 dark:bg-indigo-500/30 rounded-full blur-[120px]" />
      </div>

      <Header address={address} hasWallet={hasWallet} notifications={pendingPayments} inbox={inboxMessages} usdcBalance={formattedBalance} userStats={userStats} activeTab={activeTab} onNavigate={setActiveTab} />

      {/* THE FIX: Changed py-8 sm:py-12 to py-4 sm:py-6 AND max-w-4xl to max-w-2xl */}
      <main className={`flex-1 flex flex-col items-center px-4 sm:px-6 w-full mx-auto relative z-10 ${!hasWallet ? 'justify-center py-8 sm:py-12 max-w-4xl' : 'py-4 sm:py-6 max-w-2xl'}`}>
        {!hasWallet ? (
          <div className="w-full flex flex-col items-center space-y-10 sm:space-y-14 animate-fade-in">
            <div className="text-center space-y-4 sm:space-y-5 px-2 relative z-10">
              <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tighter leading-[1.05]"><span className="text-slate-900 dark:text-slate-100">Trustless Payments.</span><br/><span className="text-indigo-600 dark:text-indigo-400">Settled Instantly.</span></h1>
              <p className="text-sm sm:text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto font-medium leading-relaxed">The enterprise escrow protocol. Secure any transaction with conditional logic, arbiters, and cryptographic bonds.</p>
            </div>
            
            <div className="flex flex-wrap justify-center gap-4 sm:gap-8 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
              <div className="flex flex-col items-center px-4">
                <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono">${metrics.volume.toLocaleString()}</span>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Testnet Volume</span>
              </div>
              <div className="w-px bg-slate-200 dark:bg-slate-800 hidden sm:block"></div>
              <div className="flex flex-col items-center px-4">
                <span className="text-2xl font-black text-slate-800 dark:text-slate-200 font-mono">{metrics.escrows.toLocaleString()}</span>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Active Escrows</span>
              </div>
              <div className="w-px bg-slate-200 dark:bg-slate-800 hidden sm:block"></div>
              <div className="flex flex-col items-center px-4">
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span></span>
                  <span className="text-2xl font-black text-slate-800 dark:text-slate-200 font-mono">{metrics.users.toLocaleString()}</span>
                </div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Global Users</span>
              </div>
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
                <div className="flex justify-center p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm w-full max-w-md">
                  <TabButton active={activeTab === 'create'} onClick={() => setActiveTab('create')} icon={PlusCircle} label="New Escrow" />
                  <TabButton active={activeTab === 'activity'} onClick={() => setActiveTab('activity')} icon={ActivityIcon} label="Activity" />
                  <TabButton active={activeTab === 'guide'} onClick={() => setActiveTab('guide')} icon={BookOpen} label="Guide" />
                </div>
                
                <div className="w-full flex justify-center min-h-[400px]">
                  {activeTab === 'create' && (
                    <div className="w-full bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)] dark:ring-1 dark:ring-white/5">
                      <EscrowForm onPaymentCreated={() => { setActiveTab('activity'); }} />
                    </div>
                  )}
                  {activeTab === 'activity' && (
                    <div className="w-full">
                      <ActivityList className="w-full" onActivityUpdate={fetchPendingPayments} />
                    </div>
                  )}
                  {activeTab === 'guide' && (
                    <div className="w-full">
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
    </div>
  );
}