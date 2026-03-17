'use client';

import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Award, Flame, CalendarCheck, Wallet, Loader2, CheckCircle, Clock, Zap, UserPlus, MessageCircle, Twitter, ArrowRightLeft } from 'lucide-react';
import { supabase } from './supabaseClient';
import { useToast } from './Toast';

const truncateAddress = (addr: string) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';
const AVATARS = ["bg-indigo-500", "bg-emerald-500", "bg-rose-500", "bg-amber-500", "bg-slate-700"];

export default function Quests({ userStats, fetchUserStats }: any) {
  const { address } = useAccount();
  const { showToast } = useToast();
  
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [timeUntilMidnight, setTimeUntilMidnight] = useState('');

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

  const lastCheckInDate = userStats?.lastCheckin ? new Date(userStats.lastCheckin) : null;
  const todayDate = new Date();
  const canCheckIn = !lastCheckInDate || lastCheckInDate.toDateString() !== todayDate.toDateString();

  const handleCheckIn = async () => {
    if (!address || isCheckingIn) return;
    setIsCheckingIn(true);
    
    let newStreak = userStats?.streak || 0;
    if (!lastCheckInDate) {
      newStreak = 1;
    } else {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      if (lastCheckInDate.toDateString() === yesterday.toDateString()) {
        newStreak += 1;
      } else if (lastCheckInDate.toDateString() !== todayDate.toDateString()) {
        newStreak = 1; 
      }
    }

    try {
      const { error } = await supabase.from('user_points').upsert({
        wallet_address: address.toLowerCase(),
        xp: (userStats?.xp || 0) + 10,
        current_streak: newStreak,
        last_checkin: todayDate.toISOString()
      });
      if (error) throw error;
      window.dispatchEvent(new Event('xp-updated'));
    } catch (e: any) {
      showToast('error', 'Check-in failed');
    } finally {
      setIsCheckingIn(false);
    }
  };

  // Simulate soft-verifying an external quest (Twitter/Discord)
  const handleExternalQuest = async (questId: string, xpReward: number, link: string) => {
    if (!address) return;
    window.open(link, '_blank');
    
    setTimeout(async () => {
      const quests = [...(userStats?.completedQuests || [])];
      if (!quests.includes(questId)) {
        quests.push(questId);
        await supabase.from('user_points').upsert({
          wallet_address: address.toLowerCase(),
          xp: (userStats?.xp || 0) + xpReward,
          completed_quests: quests
        });
        window.dispatchEvent(new Event('xp-updated'));
        showToast('success', `Quest Completed: +${xpReward} XP`);
      }
    }, 5000); // Wait 5 seconds after they click the link to award XP
  };

  if (!address) return null;

  const completedQuests = userStats?.completedQuests || [];
  const hasSetupProfile = completedQuests.includes('setup_profile');
  const hasJoinedDiscord = completedQuests.includes('join_discord');
  const hasFollowedX = completedQuests.includes('follow_x');
  const userAvatarClass = AVATARS[userStats?.avatarId || 0];

  return (
    <div className="w-full animate-fade-in pb-12 space-y-6">
      
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 shadow-sm">
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-full ${userAvatarClass} shrink-0 ring-4 ring-slate-50 dark:ring-slate-950 flex items-center justify-center text-white text-lg font-bold`}>
            {userStats?.username ? userStats.username.charAt(0).toUpperCase() : <Wallet size={20} />}
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{userStats?.username || 'Anonymous User'}</h2>
            <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-1">{truncateAddress(address)}</p>
          </div>
        </div>
        <div className="flex items-center gap-6 sm:gap-8 bg-slate-50 dark:bg-slate-950/50 py-2.5 px-5 rounded-xl border border-slate-100 dark:border-slate-800">
          <div className="flex flex-col items-center">
            <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">{userStats?.xp || 0}</span>
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1"><Award size={10}/> Total XP</span>
          </div>
          <div className="w-px h-8 bg-slate-200 dark:bg-slate-800"></div>
          <div className="flex flex-col items-center">
            <span className="text-xl font-black text-slate-700 dark:text-slate-300">{userStats?.streak || 0}</span>
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1"><Flame size={10}/> Streak</span>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950/50">
          <h3 className="font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider text-xs flex items-center gap-2"><Zap size={16} className="text-amber-500" /> Active Quests</h3>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
          
          {/* Daily Check-in */}
          <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
            <div className="flex gap-4 items-center">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${canCheckIn ? 'bg-amber-50 text-amber-500 dark:bg-amber-500/10' : 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10'}`}>
                <CalendarCheck size={20} />
              </div>
              <div>
                <p className="font-bold text-sm text-slate-900 dark:text-slate-100">Daily Check-in</p>
                <p className="text-xs text-slate-500 mt-0.5">Return every 24 hours to earn XP and build your streak.</p>
              </div>
            </div>
            <button onClick={handleCheckIn} disabled={!canCheckIn || isCheckingIn} className={`px-4 py-2 rounded-xl font-bold text-xs shrink-0 transition-all ${canCheckIn ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm hover:shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed flex items-center gap-1.5'}`}>
              {isCheckingIn ? '...' : canCheckIn ? 'Claim +10 XP' : <><Clock size={12} /> Next in {timeUntilMidnight}</>}
            </button>
          </div>

          {/* Setup Identity */}
          <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
            <div className="flex gap-4 items-center">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${hasSetupProfile ? 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10' : 'bg-indigo-50 text-indigo-500 dark:bg-indigo-500/10'}`}>
                <UserPlus size={20} />
              </div>
              <div>
                <p className="font-bold text-sm text-slate-900 dark:text-slate-100">Setup Identity</p>
                <p className="text-xs text-slate-500 mt-0.5">Save a custom username and pick an avatar in your Profile.</p>
              </div>
            </div>
            {hasSetupProfile ? (
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold text-xs bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800"><CheckCircle size={14} /> Completed</div>
            ) : (
              <div className="px-4 py-2 rounded-xl font-bold text-xs shrink-0 bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">+100 XP</div>
            )}
          </div>

          {/* Join Discord */}
          <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
            <div className="flex gap-4 items-center">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${hasJoinedDiscord ? 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10' : 'bg-indigo-50 text-indigo-500 dark:bg-indigo-500/10'}`}>
                <MessageCircle size={20} />
              </div>
              <div>
                <p className="font-bold text-sm text-slate-900 dark:text-slate-100">Join the Discord Community</p>
                <p className="text-xs text-slate-500 mt-0.5">Get the Verified role to access announcements and content submission channels.</p>
              </div>
            </div>
            {hasJoinedDiscord ? (
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold text-xs bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800"><CheckCircle size={14} /> Completed</div>
            ) : (
              <button onClick={() => handleExternalQuest('join_discord', 50, '#')} className="px-4 py-2 rounded-xl font-bold text-xs shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow-md transition-all">Claim +50 XP</button>
            )}
          </div>

          {/* Follow on X */}
          <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
            <div className="flex gap-4 items-center">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${hasFollowedX ? 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10' : 'bg-indigo-50 text-indigo-500 dark:bg-indigo-500/10'}`}>
                <Twitter size={20} />
              </div>
              <div>
                <p className="font-bold text-sm text-slate-900 dark:text-slate-100">Follow @Custodex on X</p>
                <p className="text-xs text-slate-500 mt-0.5">Stay updated on our latest testnet launches and bounty programs.</p>
              </div>
            </div>
            {hasFollowedX ? (
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold text-xs bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800"><CheckCircle size={14} /> Completed</div>
            ) : (
              <button onClick={() => handleExternalQuest('follow_x', 50, '#')} className="px-4 py-2 rounded-xl font-bold text-xs shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow-md transition-all">Claim +50 XP</button>
            )}
          </div>

          {/* Execute $20 Escrow */}
          <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
            <div className="flex gap-4 items-center">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-indigo-50 text-indigo-500 dark:bg-indigo-500/10">
                <ArrowRightLeft size={20} />
              </div>
              <div>
                <p className="font-bold text-sm text-slate-900 dark:text-slate-100">Generate Testnet Volume</p>
                <p className="text-xs text-slate-500 mt-0.5">Successfully complete an escrow transaction worth $20 USDC or more.</p>
              </div>
            </div>
            <div className="px-4 py-2 rounded-xl font-bold text-xs shrink-0 bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">+100 XP (Auto-tracks)</div>
          </div>

          {/* Connect Wallet */}
          <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-950/20">
            <div className="flex gap-4 items-center">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10">
                <Wallet size={20} />
              </div>
              <div>
                <p className="font-bold text-sm text-slate-900 dark:text-slate-100">Connect Wallet</p>
                <p className="text-xs text-slate-500 mt-0.5">One-time bonus for entering the protocol.</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold text-xs bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800"><CheckCircle size={14} /> Completed</div>
          </div>

        </div>
      </div>
    </div>
  );
}