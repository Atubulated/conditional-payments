'use client';

import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Award, Flame, CalendarCheck, CheckCircle, Clock, UserPlus, MessageCircle, Twitter, ArrowRightLeft, Repeat, ShieldAlert, CheckCircle2, Scale, PlusCircle, ShieldCheck, History, Ban, Undo2, BookOpen, Send, AlertTriangle } from 'lucide-react';
import { supabase } from './supabaseClient';
import { useToast } from './Toast';
import ProfileAvatar from './ProfileAvatar';

const truncateAddress = (addr: string) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';

export default function Quests({ userStats, fetchUserStats, processQuestClaim }: any) {
  const { address } = useAccount();
  const { showToast } = useToast();

  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [timeUntilMidnight, setTimeUntilMidnight] = useState('');
  const [activeTab, setActiveTab] = useState<'once' | 'daily'>('once');
  const [escrowActivity, setEscrowActivity] = useState<any[]>([]);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      const diff = midnight.getTime() - now.getTime();
      const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setTimeUntilMidnight(`${h}h ${m}m`);
    };
    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!address) return;
    const fetchActivity = async () => {
      const { data } = await supabase
        .from('escrow_payments')
        .select('*')
        .or(`sender.eq.${address.toLowerCase()},receiver.eq.${address.toLowerCase()},arbiter.eq.${address.toLowerCase()}`);
      if (data) setEscrowActivity(data);
    };
    fetchActivity();
  }, [address]);

  const lastCheckInDate = userStats?.lastCheckin ? new Date(userStats.lastCheckin) : null;
  const todayDate = new Date();
  const canCheckIn = !lastCheckInDate || lastCheckInDate.toDateString() !== todayDate.toDateString();

  const handleCheckIn = async () => {
    if (!address || isCheckingIn) return;
    setIsCheckingIn(true);
    try {
      let newStreak = userStats?.streak || 0;
      if (!lastCheckInDate) newStreak = 1;
      else {
        const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
        if (lastCheckInDate.toDateString() === yesterday.toDateString()) newStreak += 1;
        else if (lastCheckInDate.toDateString() !== todayDate.toDateString()) newStreak = 1;
      }
      await supabase.from('user_points').upsert({
        wallet_address: address.toLowerCase(),
        xp: (userStats?.xp || 0) + 10,
        current_streak: newStreak,
        last_checkin: todayDate.toISOString()
      });
      showToast('success', 'Daily Check-in Complete (+10 XP)');
      await fetchUserStats();
    } catch (e: any) {
      showToast('error', 'Check-in failed');
    } finally {
      setIsCheckingIn(false);
    }
  };

  if (!address) return null;

  const completedQuests = userStats?.completedQuests || [];
  const readGuides = userStats?.readGuides || [];
  const hasReadGuides = readGuides.length >= 3;
  const today = new Date().toISOString().split('T')[0];

  const isCompleted = (id: string, isDaily: boolean = false) =>
    isDaily ? completedQuests.includes(`${id}_${today}`) : completedQuests.includes(id);

  const isUsernameSet = userStats?.username && !userStats.username.startsWith('User_');
  const isDpSet = userStats?.avatarId !== 0;

  // Today's date boundaries
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

  const todayPayments = escrowActivity.filter(p => {
    const created = new Date(p.created_at);
    return created >= todayStart && created <= todayEnd;
  });

  // ✅ Timelocked quest checks
  const hasSentTimelocked = todayPayments.some(p =>
    p.sender === address?.toLowerCase() && p.p_type === 1);
  const hasReceivedTimelocked = todayPayments.some(p =>
    p.receiver === address?.toLowerCase() && p.p_type === 1 && p.status >= 3);
  const hasDeclinedTimelocked = todayPayments.some(p =>
    p.receiver === address?.toLowerCase() && p.p_type === 1 && p.is_declined === true);
  const hasReclaimedTimelocked = todayPayments.some(p =>
    p.sender === address?.toLowerCase() && p.p_type === 1 && p.status === 4);

  // ✅ Mediated quest checks
  const hasSentMediated = todayPayments.some(p =>
    p.sender === address?.toLowerCase() && p.p_type === 2);
  const hasReceivedMediated = todayPayments.some(p =>
    p.receiver === address?.toLowerCase() && p.p_type === 2 && p.status >= 3);
  const hasServedAsArbiter = todayPayments.some(p =>
    p.arbiter === address?.toLowerCase() && p.p_type === 2 && p.status === 3);
  const hasRaisedDispute = todayPayments.some(p =>
    (p.sender === address?.toLowerCase() || p.receiver === address?.toLowerCase()) && p.status === 2);
  const hasReleasedFunds = todayPayments.some(p =>
    p.sender === address?.toLowerCase() && p.p_type === 2 && p.status === 3);
  const hasRefundedSender = todayPayments.some(p =>
    p.arbiter === address?.toLowerCase() && p.p_type === 2 &&
    p.resolved_to?.toLowerCase() === p.sender?.toLowerCase());

  // ✅ Bonded quest checks
  const hasCreatedBonded = todayPayments.some(p =>
    p.sender === address?.toLowerCase() && p.p_type === 3);
  const hasReceivedBonded = todayPayments.some(p =>
    p.receiver === address?.toLowerCase() && p.p_type === 3 && p.status >= 1);
  const hasDeclinedBonded = todayPayments.some(p =>
    p.receiver === address?.toLowerCase() && p.p_type === 3 && p.is_declined === true);
  const hasSlashedBonded = todayPayments.some(p =>
    p.sender === address?.toLowerCase() && p.p_type === 3 && p.status === 3 &&
    p.resolved_to === '0x0000000000000000000000000000000000000000');

  const renderQuestButton = (questId: string, xpReward: number, isDaily: boolean, onClick: () => void, disabled: boolean = false) => {
    const done = isCompleted(questId, isDaily);
    if (done) return (
      <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold text-xs bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
        <CheckCircle size={14} /> Claimed
      </div>
    );
    if (disabled) return (
      <button disabled className="px-4 py-1.5 rounded-xl font-bold text-xs shrink-0 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 cursor-not-allowed transition-all">
        Claim +{xpReward} XP
      </button>
    );
    return (
      <button
        onClick={() => { onClick(); processQuestClaim(questId, xpReward, isDaily); }}
        className="px-4 py-1.5 rounded-xl font-bold text-xs shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow-md transition-all"
      >
        Claim +{xpReward} XP
      </button>
    );
  };

  return (
    <div className="w-full animate-fade-in pb-8 space-y-4">

      {/* Profile Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-slate-100 dark:bg-slate-800 ring-4 ring-slate-50 dark:ring-slate-950 pointer-events-none shadow-sm">
            <div className="w-[100px] h-[100px] flex items-center justify-center shrink-0 origin-center scale-[0.48]">
              <ProfileAvatar />
            </div>
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{userStats?.username || 'Anonymous User'}</h2>
            <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-0.5">{truncateAddress(address)}</p>
          </div>
        </div>
        <div className="flex items-center gap-5 sm:gap-6 bg-slate-50 dark:bg-slate-950/50 py-2 px-4 rounded-xl border border-slate-100 dark:border-slate-800">
          <div className="flex flex-col items-center">
            <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">{userStats?.xp || 0}</span>
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1"><Award size={10} /> Total XP</span>
          </div>
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-800"></div>
          <div className="flex flex-col items-center">
            <span className="text-lg font-black text-slate-700 dark:text-slate-300">{userStats?.streak || 0}</span>
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1"><Flame size={10} /> Streak</span>
          </div>
        </div>
      </div>

      {/* Quests Panel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">

        <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
          <div className="flex p-1 bg-slate-200/50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl">
            <button onClick={() => setActiveTab('once')} className={`flex-1 py-1.5 text-xs sm:text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${activeTab === 'once' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/50 dark:border-slate-700/50' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent'}`}>
              <Award size={14} /> One-Time Milestones
            </button>
            <button onClick={() => setActiveTab('daily')} className={`flex-1 py-1.5 text-xs sm:text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${activeTab === 'daily' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/50 dark:border-slate-700/50' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent'}`}>
              <Repeat size={14} /> Daily Missions
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800/50">

          {/* ───── ONE-TIME MILESTONES ───── */}
          {activeTab === 'once' && (
            <>
              <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                <div className="flex gap-3 items-center">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-indigo-50 text-indigo-500 dark:bg-indigo-500/10"><UserPlus size={16} /></div>
                  <div><p className="font-bold text-sm text-slate-900 dark:text-slate-100">Connect Wallet</p><p className="text-[10px] text-slate-500 mt-0.5">Connect your wallet to the platform.</p></div>
                </div>
                {renderQuestButton('connect_wallet', 50, false, () => {}, false)}
              </div>

              <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                <div className="flex gap-3 items-center">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-indigo-50 text-indigo-500 dark:bg-indigo-500/10"><UserPlus size={16} /></div>
                  <div><p className="font-bold text-sm text-slate-900 dark:text-slate-100">Setup Username</p><p className="text-[10px] text-slate-500 mt-0.5">Customize your display name in the Profile tab.</p></div>
                </div>
                {renderQuestButton('setup_username', 50, false, () => {}, !isUsernameSet)}
              </div>

              <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                <div className="flex gap-3 items-center">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-indigo-50 text-indigo-500 dark:bg-indigo-500/10"><UserPlus size={16} /></div>
                  <div><p className="font-bold text-sm text-slate-900 dark:text-slate-100">Setup Display Picture</p><p className="text-[10px] text-slate-500 mt-0.5">Upload a custom profile picture in the Profile tab.</p></div>
                </div>
                {renderQuestButton('setup_dp', 50, false, () => {}, !isDpSet)}
              </div>

              <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                <div className="flex gap-3 items-center">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-indigo-50 text-indigo-500 dark:bg-indigo-500/10"><MessageCircle size={16} /></div>
                  <div><p className="font-bold text-sm text-slate-900 dark:text-slate-100">Connect Discord</p><p className="text-[10px] text-slate-500 mt-0.5">Link your Discord account via the Profile settings.</p></div>
                </div>
                {renderQuestButton('connect_discord', 100, false, () => {}, !userStats?.discordConnected)}
              </div>

              <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                <div className="flex gap-3 items-center">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-indigo-50 text-indigo-500 dark:bg-indigo-500/10"><Send size={16} /></div>
                  <div><p className="font-bold text-sm text-slate-900 dark:text-slate-100">Connect Telegram</p><p className="text-[10px] text-slate-500 mt-0.5">Link your Telegram account via the Profile settings.</p></div>
                </div>
                {renderQuestButton('connect_telegram', 100, false, () => {}, !userStats?.telegramConnected)}
              </div>

              <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                <div className="flex gap-3 items-center">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-indigo-50 text-indigo-500 dark:bg-indigo-500/10"><Twitter size={16} /></div>
                  <div><p className="font-bold text-sm text-slate-900 dark:text-slate-100">Connect Twitter / X</p><p className="text-[10px] text-slate-500 mt-0.5">Link your X account via the Profile settings.</p></div>
                </div>
                {renderQuestButton('connect_twitter', 100, false, () => {}, !userStats?.twitterConnected)}
              </div>

              <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                <div className="flex gap-3 items-center">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-indigo-50 text-indigo-500 dark:bg-indigo-500/10"><BookOpen size={16} /></div>
                  <div><p className="font-bold text-sm text-slate-900 dark:text-slate-100">Protocol Scholar</p><p className="text-[10px] text-slate-500 mt-0.5">Read all 3 escrow modules in the Guide tab.</p></div>
                </div>
                {renderQuestButton('read_guide', 50, false, () => {}, !hasReadGuides)}
              </div>

              <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                <div className="flex gap-3 items-center">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-indigo-50 text-indigo-500 dark:bg-indigo-500/10"><ArrowRightLeft size={16} /></div>
                  <div><p className="font-bold text-sm text-slate-900 dark:text-slate-100">Generate Volume</p><p className="text-[10px] text-slate-500 mt-0.5">Complete escrows totaling at least $20 USDC in volume.</p></div>
                </div>
                {(() => {
  const totalVolume = escrowActivity
    .filter(p => p.sender === address?.toLowerCase() && p.status === 3)
    .reduce((sum, p) => sum + Number(p.amount), 0) / 1e6;
  return renderQuestButton('gen_volume', 1000, false, () => {}, totalVolume < 20);
})()}
              </div>
            </>
          )}

          {/* ───── DAILY MISSIONS ───── */}
          {activeTab === 'daily' && (
            <>
              {/* Daily Check-in */}
              <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors bg-amber-50/30 dark:bg-amber-900/5">
                <div className="flex gap-3 items-center">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${canCheckIn ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/20' : 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10'}`}><CalendarCheck size={16} /></div>
                  <div><p className="font-bold text-sm text-slate-900 dark:text-slate-100">Daily Check-in</p><p className="text-[10px] text-slate-500 mt-0.5">Return every 24 hours to earn XP and build your streak.</p></div>
                </div>
                <button onClick={handleCheckIn} disabled={!canCheckIn || isCheckingIn} className={`px-4 py-1.5 rounded-xl font-bold text-xs shrink-0 transition-all ${canCheckIn ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed flex items-center gap-1.5'}`}>
                  {isCheckingIn ? '...' : canCheckIn ? 'Claim +10 XP' : <><Clock size={12} /> Next in {timeUntilMidnight}</>}
                </button>
              </div>

              {/* Mediated Missions */}
              <div className="px-5 py-1.5 bg-slate-50 dark:bg-slate-900 border-y border-slate-100 dark:border-slate-800">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5"><ShieldAlert size={10} /> Mediated Escrow Missions</span>
              </div>
              <div className="p-3.5 sm:p-4 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-800/30">
                <div className="flex gap-3 items-center"><ArrowRightLeft size={14} className="text-slate-400" /><div><p className="font-bold text-sm text-slate-900 dark:text-slate-100">Send Mediated Escrow</p></div></div>
                {renderQuestButton('daily_send_med', 20, true, () => {}, !hasSentMediated)}
              </div>
              <div className="p-3.5 sm:p-4 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-800/30">
                <div className="flex gap-3 items-center"><CheckCircle2 size={14} className="text-slate-400" /><div><p className="font-bold text-sm text-slate-900 dark:text-slate-100">Receive Mediated Escrow</p></div></div>
                {renderQuestButton('daily_recv_med', 20, true, () => {}, !hasReceivedMediated)}
              </div>
              <div className="p-3.5 sm:p-4 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-800/30">
                <div className="flex gap-3 items-center"><Scale size={14} className="text-slate-400" /><div><p className="font-bold text-sm text-slate-900 dark:text-slate-100">Serve as Arbiter</p></div></div>
                {renderQuestButton('daily_arb_med', 30, true, () => {}, !hasServedAsArbiter)}
              </div>
              <div className="p-3.5 sm:p-4 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-800/30">
                <div className="flex gap-3 items-center"><AlertTriangle size={14} className="text-slate-400" /><div><p className="font-bold text-sm text-slate-900 dark:text-slate-100">Raise a Dispute</p></div></div>
                {renderQuestButton('daily_dispute_med', 15, true, () => {}, !hasRaisedDispute)}
              </div>
              <div className="p-3.5 sm:p-4 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-800/30">
                <div className="flex gap-3 items-center"><CheckCircle size={14} className="text-slate-400" /><div><p className="font-bold text-sm text-slate-900 dark:text-slate-100">Release Funds to Receiver</p></div></div>
                {renderQuestButton('daily_rel_recv_med', 20, true, () => {}, !hasReleasedFunds)}
              </div>
              <div className="p-3.5 sm:p-4 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-800/30">
                <div className="flex gap-3 items-center"><Undo2 size={14} className="text-slate-400" /><div><p className="font-bold text-sm text-slate-900 dark:text-slate-100">Refund the Sender</p></div></div>
                {renderQuestButton('daily_ref_send_med', 20, true, () => {}, !hasRefundedSender)}
              </div>

              {/* Bonded Missions */}
              <div className="px-5 py-1.5 bg-slate-50 dark:bg-slate-900 border-y border-slate-100 dark:border-slate-800">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5"><Flame size={10} /> Bonded Escrow Missions</span>
              </div>
              <div className="p-3.5 sm:p-4 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-800/30">
                <div className="flex gap-3 items-center"><PlusCircle size={14} className="text-slate-400" /><div><p className="font-bold text-sm text-slate-900 dark:text-slate-100">Create Bonded Escrow</p></div></div>
                {renderQuestButton('daily_create_bond', 30, true, () => {}, !hasCreatedBonded)}
              </div>
              <div className="p-3.5 sm:p-4 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-800/30">
                <div className="flex gap-3 items-center"><ShieldCheck size={14} className="text-slate-400" /><div><p className="font-bold text-sm text-slate-900 dark:text-slate-100">Receive Bonded Escrow</p></div></div>
                {renderQuestButton('daily_recv_bond', 30, true, () => {}, !hasReceivedBonded)}
              </div>
              <div className="p-3.5 sm:p-4 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-800/30">
                <div className="flex gap-3 items-center"><Ban size={14} className="text-slate-400" /><div><p className="font-bold text-sm text-slate-900 dark:text-slate-100">Decline Bonded Escrow</p></div></div>
                {renderQuestButton('daily_dec_bond', 5, true, () => {}, !hasDeclinedBonded)}
              </div>
              <div className="p-3.5 sm:p-4 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-800/30">
                <div className="flex gap-3 items-center"><Flame size={14} className="text-slate-400" /><div><p className="font-bold text-sm text-slate-900 dark:text-slate-100">Dispute (Slash) Bonded Escrow</p></div></div>
                {renderQuestButton('daily_slash_bond', 20, true, () => {}, !hasSlashedBonded)}
              </div>

              {/* Timelocked Missions */}
              <div className="px-5 py-1.5 bg-slate-50 dark:bg-slate-900 border-y border-slate-100 dark:border-slate-800">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5"><Clock size={10} /> Timelocked Missions</span>
              </div>
              <div className="p-3.5 sm:p-4 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-800/30">
                <div className="flex gap-3 items-center"><History size={14} className="text-slate-400" /><div><p className="font-bold text-sm text-slate-900 dark:text-slate-100">Send Timelocked Escrow</p></div></div>
                {renderQuestButton('daily_send_time', 15, true, () => {}, !hasSentTimelocked)}
              </div>
              <div className="p-3.5 sm:p-4 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-800/30">
                <div className="flex gap-3 items-center"><CheckCircle size={14} className="text-slate-400" /><div><p className="font-bold text-sm text-slate-900 dark:text-slate-100">Receive Timelocked Escrow</p></div></div>
                {renderQuestButton('daily_recv_time', 15, true, () => {}, !hasReceivedTimelocked)}
              </div>
              <div className="p-3.5 sm:p-4 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-800/30">
                <div className="flex gap-3 items-center"><Ban size={14} className="text-slate-400" /><div><p className="font-bold text-sm text-slate-900 dark:text-slate-100">Decline Timelocked Escrow</p></div></div>
                {renderQuestButton('daily_dec_time', 5, true, () => {}, !hasDeclinedTimelocked)}
              </div>
              <div className="p-3.5 sm:p-4 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-800/30">
                <div className="flex gap-3 items-center"><Undo2 size={14} className="text-slate-400" /><div><p className="font-bold text-sm text-slate-900 dark:text-slate-100">Reclaim Timelocked Escrow</p></div></div>
                {renderQuestButton('daily_rec_time', 5, true, () => {}, !hasReclaimedTimelocked)}
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}