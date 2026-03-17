'use client';

import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Award, Flame, Copy, Wallet, Loader2, Check, UserPlus, Image as ImageIcon } from 'lucide-react';
import { supabase } from './supabaseClient';

const truncateAddress = (addr: string) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';
const AVATARS = ["bg-indigo-500", "bg-emerald-500", "bg-rose-500", "bg-amber-500", "bg-slate-700"];

export default function Profile({ userStats, fetchUserStats }: any) {
  const { address } = useAccount();
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const [usernameInput, setUsernameInput] = useState(userStats?.username || '');
  const [selectedAvatar, setSelectedAvatar] = useState(userStats?.avatarId || 0);

  useEffect(() => {
    setUsernameInput(userStats?.username || '');
    setSelectedAvatar(userStats?.avatarId || 0);
  }, [userStats]);

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const handleSaveProfile = async () => {
    if (!address || usernameInput.trim().length < 3) return; 
    
    setIsSavingProfile(true);
    try {
      let currentXp = userStats?.xp || 0;
      let quests = [...(userStats?.completedQuests || [])];

      if (!quests.includes('setup_profile')) {
        quests.push('setup_profile');
        currentXp += 100;
      }

      await supabase.from('user_points').upsert({
        wallet_address: address.toLowerCase(),
        username: usernameInput.trim(),
        avatar_id: selectedAvatar,
        xp: currentXp,
        completed_quests: quests
      });

      window.dispatchEvent(new Event('xp-updated'));
    } catch (e: any) {
      // Silent fail
    } finally {
      setIsSavingProfile(false);
    }
  };

  if (!address) return null;
  const userAvatarClass = AVATARS[userStats?.avatarId || 0];

  return (
    <div className="w-full animate-fade-in pb-12 space-y-6">
      
      {/* TIGHTENED: Top Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 shadow-sm">
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-full ${userAvatarClass} shrink-0 ring-4 ring-slate-50 dark:ring-slate-950 flex items-center justify-center text-white text-lg font-bold`}>
            {userStats?.username ? userStats.username.charAt(0).toUpperCase() : <Wallet size={20} />}
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{userStats?.username || 'Anonymous User'}</h2>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs font-mono text-slate-500 dark:text-slate-400">{truncateAddress(address)}</p>
              <button onClick={() => handleCopyHash(address)} className="text-slate-400 hover:text-indigo-500 transition-colors">
                {copiedHash === address ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
              </button>
            </div>
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

      {/* Settings Form - Tightened Paddings */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm animate-fade-in">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
          <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Identity Settings</h3>
          <p className="text-xs text-slate-500 mt-1">Manage your public profile and wallet connection.</p>
        </div>
        <div className="p-5 sm:p-6 space-y-6">
          
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2"><UserPlus size={14}/> Display Name</label>
            <input 
              type="text" 
              placeholder="Enter a username..." 
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              className="w-full max-w-md bg-transparent border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
            />
          </div>

          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2"><ImageIcon size={14}/> Profile Color</label>
            <div className="flex gap-3">
              {AVATARS.map((bgClass, idx) => (
                <button 
                  key={idx} 
                  onClick={() => setSelectedAvatar(idx)}
                  className={`w-10 h-10 rounded-full ${bgClass} transition-all duration-200 ${selectedAvatar === idx ? 'ring-4 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900 scale-110' : 'opacity-60 hover:opacity-100 hover:scale-105'}`}
                />
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800/50 flex flex-col sm:flex-row items-center gap-3">
            <button 
              onClick={handleSaveProfile} 
              disabled={isSavingProfile || (usernameInput === userStats?.username && selectedAvatar === userStats?.avatarId) || usernameInput.trim().length < 3}
              className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-all disabled:opacity-50 active:scale-95 flex items-center justify-center gap-2 shadow-sm"
            >
              {isSavingProfile ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {isSavingProfile ? 'Saving...' : 'Save Profile'}
            </button>
            
            <ConnectButton.Custom>
              {({ openAccountModal }) => (
                <button onClick={openAccountModal} className="w-full sm:w-auto px-6 py-2.5 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center">
                  Manage Wallet Connection
                </button>
              )}
            </ConnectButton.Custom>
          </div>

        </div>
      </div>

    </div>
  );
}