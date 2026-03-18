'use client';

import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Award, Flame, Wallet, Trophy, Medal } from 'lucide-react';
import { supabase } from './supabaseClient';

const truncateAddress = (addr: string) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';
const AVATARS = ["bg-indigo-500", "bg-emerald-500", "bg-rose-500", "bg-amber-500", "bg-slate-700"];

export default function Leaderboard({ userStats }: any) {
  const { address } = useAccount();
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      const { data, error } = await supabase
        .from('user_points')
        .select('wallet_address, xp, username, avatar_id')
        .order('xp', { ascending: false })
        .limit(50); 
      
      if (!error && data) setLeaderboard(data);
    };
    fetchLeaderboard();
  }, []);

  if (!address) return null;
  const userAvatarClass = AVATARS[userStats?.avatarId || 0];

  return (
    <div className="w-full animate-fade-in pb-8 space-y-4">
      
      {/* TIGHTENED: Top Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-full ${userAvatarClass} shrink-0 ring-4 ring-slate-50 dark:ring-slate-950 flex items-center justify-center text-white text-base font-bold`}>
            {userStats?.username ? userStats.username.charAt(0).toUpperCase() : <Wallet size={16} />}
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{userStats?.username || 'Anonymous User'}</h2>
            <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-0.5">{truncateAddress(address)}</p>
          </div>
        </div>
        <div className="flex items-center gap-5 sm:gap-6 bg-slate-50 dark:bg-slate-950/50 py-2 px-4 rounded-xl border border-slate-100 dark:border-slate-800">
          <div className="flex flex-col items-center">
            <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">{userStats?.xp || 0}</span>
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1"><Award size={10}/> Total XP</span>
          </div>
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-800"></div>
          <div className="flex flex-col items-center">
            <span className="text-lg font-black text-slate-700 dark:text-slate-300">{userStats?.streak || 0}</span>
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1"><Flame size={10}/> Streak</span>
          </div>
        </div>
      </div>

      {/* TIGHTENED: Leaderboard Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm h-full">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3 bg-slate-50 dark:bg-slate-950/50">
          <Trophy size={18} className="text-indigo-500" />
          <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm tracking-wide">Global Leaderboard</h3>
        </div>
        
        <div className="flex flex-col">
          {leaderboard.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">No ranked users yet. Claim some XP to be first!</div>
          ) : (
            leaderboard.map((user, index) => {
              const isCurrentUser = address?.toLowerCase() === user.wallet_address.toLowerCase();
              const avatarClass = AVATARS[user.avatar_id || 0];
              
              return (
                <div key={user.wallet_address} className={`flex items-center justify-between p-3.5 sm:p-4 border-b border-slate-50 dark:border-slate-800/50 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${isCurrentUser ? 'bg-indigo-50/50 dark:bg-indigo-900/20' : ''}`}>
                  <div className="flex items-center gap-4">
                    <span className="w-5 text-xs font-bold text-slate-400 text-right shrink-0">{index + 1}</span>
                    <div className="w-5 flex justify-center shrink-0">
                      {index === 0 ? <Medal size={18} className="text-amber-400 drop-shadow-sm" /> :
                       index === 1 ? <Medal size={18} className="text-slate-400 drop-shadow-sm" /> :
                       index === 2 ? <Medal size={18} className="text-amber-700 drop-shadow-sm" /> :
                       null}
                    </div>
                    <div className={`w-8 h-8 rounded-full ${avatarClass} shrink-0 ring-2 ring-slate-100 dark:ring-slate-800`} />
                    <div className="flex flex-col">
                      <span className={`text-sm font-bold ${isCurrentUser ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-900 dark:text-slate-100'}`}>
                        {user.username || truncateAddress(user.wallet_address)} {isCurrentUser && '(You)'}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 mt-0.5">{truncateAddress(user.wallet_address)}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-xs font-black text-slate-900 dark:text-slate-100">{user.xp} XP</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

    </div>
  );
}