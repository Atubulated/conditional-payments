'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAccount, useDisconnect } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Award, Flame, Copy, Wallet, Loader2, Check, UserPlus, Image as ImageIcon, MessageCircle, AlertTriangle } from 'lucide-react';
import { supabase } from './supabaseClient';
import { useToast } from './Toast';

const truncateAddress = (addr: string) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';
const AVATARS = ["bg-indigo-500", "bg-emerald-500", "bg-rose-500", "bg-amber-500", "bg-slate-700"];

export default function Profile({ userStats, fetchUserStats }: any) {
  const { address } = useAccount();
  const { disconnect } = useDisconnect();
  const { showToast } = useToast();
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  
  const [showDeleteModal, setShowDeleteModal] = useState(false);

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
      await supabase.from('user_points').upsert({
        wallet_address: address.toLowerCase(),
        username: usernameInput.trim(),
        avatar_id: selectedAvatar
      });
      showToast('success', 'Profile settings saved');
      await fetchUserStats();
    } catch (e: any) {
      showToast('error', 'Failed to save');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleDiscordConnect = async () => {
    if (!address) return;
    try {
      await supabase.from('user_points').upsert({
        wallet_address: address.toLowerCase(),
        discord_connected: true
      });
      showToast('success', 'Discord linked successfully');
      await fetchUserStats();
    } catch (e) {
      showToast('error', 'Discord link failed');
    }
  };

  const executeUnlinkWallet = async () => {
    if (!address) return;
    setIsUnlinking(true);
    try {
      await supabase.from('user_points').delete().eq('wallet_address', address.toLowerCase());
      await supabase.from('user_read_state').delete().eq('wallet_address', address.toLowerCase());
      
      showToast('success', 'Account permanently deleted');
      setShowDeleteModal(false);
      disconnect();
    } catch (e) {
      showToast('error', 'Failed to delete account');
      setIsUnlinking(false);
    }
  };

  if (!address) return null;
  const userAvatarClass = AVATARS[userStats?.avatarId || 0];

  return (
    <div className="w-full animate-fade-in pb-8 space-y-4 relative">
      
      {/* TIGHTENED: Top Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-full ${userAvatarClass} shrink-0 ring-4 ring-slate-50 dark:ring-slate-950 flex items-center justify-center text-white text-base font-bold`}>
            {userStats?.username ? userStats.username.charAt(0).toUpperCase() : <Wallet size={16} />}
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{userStats?.username || 'Anonymous User'}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs font-mono text-slate-500 dark:text-slate-400">{truncateAddress(address)}</p>
              <button onClick={() => handleCopyHash(address)} className="text-slate-400 hover:text-indigo-500 transition-colors">
                {copiedHash === address ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
              </button>
            </div>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* TIGHTENED: Settings Form */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm animate-fade-in">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Identity Settings</h3>
            <p className="text-xs text-slate-500 mt-0.5">Manage your public profile.</p>
          </div>
          <div className="p-4 sm:p-5 space-y-5">
            
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2"><UserPlus size={12}/> Display Name</label>
              <input 
                type="text" 
                placeholder="Enter a username..." 
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                className="w-full bg-transparent border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2"><ImageIcon size={12}/> Profile Color</label>
              <div className="flex gap-3">
                {AVATARS.map((bgClass, idx) => (
                  <button 
                    key={idx} 
                    onClick={() => setSelectedAvatar(idx)}
                    className={`w-8 h-8 rounded-full ${bgClass} transition-all duration-200 ${selectedAvatar === idx ? 'ring-4 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900 scale-110' : 'opacity-60 hover:opacity-100 hover:scale-105'}`}
                  />
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800/50">
              <button 
                onClick={handleSaveProfile} 
                disabled={isSavingProfile || (usernameInput === userStats?.username && selectedAvatar === userStats?.avatarId) || usernameInput.trim().length < 3}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-50 active:scale-95 flex items-center justify-center gap-2 shadow-sm"
              >
                {isSavingProfile ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {isSavingProfile ? 'Saving...' : 'Save Profile'}
              </button>
            </div>

          </div>
        </div>

        {/* TIGHTENED: Third Party Integrations */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm animate-fade-in">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Integrations</h3>
            <p className="text-xs text-slate-500 mt-0.5">Connect external accounts and wallets.</p>
          </div>
          <div className="p-4 sm:p-5 space-y-4">
            
            <div className="flex flex-col gap-2 pb-4 border-b border-slate-100 dark:border-slate-800/50">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#5865F2]/10 text-[#5865F2] flex items-center justify-center"><MessageCircle size={14}/></div>
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">Discord</span>
                </div>
                {userStats?.discordConnected ? (
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-md">
                    {userStats?.discordUsername || 'User#1234'}
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">Not Linked</span>
                )}
              </div>
              {!userStats?.discordConnected && (
                <button onClick={handleDiscordConnect} className="w-full py-2 bg-[#5865F2] hover:bg-[#4752C4] text-white text-[11px] font-bold rounded-lg transition-colors shadow-sm mt-1">
                  Connect Discord
                </button>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mt-0.5"><Wallet size={14}/></div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100">Primary Wallet</span>
                    <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-0.5 break-all">{address}</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setShowDeleteModal(true)} 
                className="w-full py-2 border border-rose-300 dark:border-rose-700/50 text-rose-600 dark:text-rose-400 rounded-lg text-[11px] font-bold hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors flex justify-center items-center gap-2 mt-1"
              >
                Unlink Wallet
              </button>
            </div>

          </div>
        </div>

      </div>

      {showDeleteModal && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl max-w-sm w-full space-y-6 shadow-2xl ring-1 ring-black/5 dark:ring-white/5 border border-slate-200 dark:border-slate-800">
            
            <div className="text-center space-y-4">
              <div className="w-14 h-14 bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400 border border-rose-100 dark:border-rose-500/20 rounded-full mx-auto flex items-center justify-center">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">Unlink Wallet</h2>
              <div className="p-4 bg-rose-50/50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/30 rounded-xl">
                <p className="text-sm text-rose-800 dark:text-rose-300 font-medium leading-relaxed">
                  <strong>WARNING:</strong> This action will permanently delete your profile, XP, quests, and streak data. It cannot be undone.
                </p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button 
                onClick={() => setShowDeleteModal(false)} 
                disabled={isUnlinking}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-sm transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                onClick={executeUnlinkWallet} 
                disabled={isUnlinking}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-sm shadow-md transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isUnlinking ? <Loader2 size={16} className="animate-spin" /> : null}
                {isUnlinking ? 'Deleting...' : 'Yes, Unlink'}
              </button>
            </div>
            
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}