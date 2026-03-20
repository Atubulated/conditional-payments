'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAccount, useDisconnect } from 'wagmi';
import { Award, Flame, Copy, Wallet, Loader2, Check, UserPlus, AlertTriangle, Pencil, X } from 'lucide-react';
import { supabase } from './supabaseClient';
import { useToast } from './Toast';
import ProfileAvatar from './ProfileAvatar';

const truncateAddress = (addr: string) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';

declare global {
  interface Window {
    onTelegramAuth: (user: any) => void;
  }
}

const DiscordIcon = ({ size = 24, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" />
  </svg>
);

const TelegramIcon = ({ size = 24, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="m20.665 3.717-17.73 6.837c-1.21.486-1.203 1.161-.222 1.462l4.552 1.42 10.532-6.645c.498-.303.953-.14.579.192l-8.533 7.701h-.002l.002.001-.314 4.692c.46 0 .663-.211.921-.46l2.211-2.15 4.599 3.377c.848.467 1.457.227 1.668-.785l3.019-14.228c.309-1.239-.473-1.8-1.282-1.414z" />
  </svg>
);

const TwitterIcon = ({ size = 24, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const TelegramAuthWidget = ({ botName, onAuth }: { botName: string, onAuth: (user: any) => void }) => {
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace('#', '?'));
    const tgAuthResult = params.get('tgAuthResult');
    if (tgAuthResult) {
      try {
        const userData = JSON.parse(atob(tgAuthResult));
        onAuth(userData);
        window.history.replaceState({}, '', window.location.pathname + window.location.search);
      } catch (e) {
        console.error('Telegram auth parse error:', e);
      }
    }
  }, []);

  const handleTelegramLogin = () => {
    const botId = process.env.NEXT_PUBLIC_TELEGRAM_BOT_ID;
    const origin = encodeURIComponent(window.location.origin);
    const returnTo = encodeURIComponent(window.location.href);
    window.location.href = `https://oauth.telegram.org/auth?bot_id=${botId}&origin=${origin}&return_to=${returnTo}`;
  };

  if (!botName || botName === 'YOUR_BOT_USERNAME_HERE') {
    return (
      <button disabled className="w-fit px-4 py-2 bg-[#24A1DE]/50 cursor-not-allowed text-white text-[11px] font-bold rounded-lg shadow-sm mt-1">
        ⚠️ Add Bot Name to Code
      </button>
    );
  }

  return (
    <button
      onClick={handleTelegramLogin}
      className="mt-1 w-fit px-4 py-2 bg-[#24A1DE] hover:bg-[#1a8fc7] text-white text-[11px] font-bold rounded-lg transition-colors shadow-sm flex items-center gap-2"
    >
      <TelegramIcon size={13} />
      Connect Telegram
    </button>
  );
};

export default function Profile({ userStats, fetchUserStats }: any) {
  const { address } = useAccount();
  const { disconnect } = useDisconnect();
  const { showToast } = useToast();

  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [usernameInput, setUsernameInput] = useState(userStats?.username || '');
  const isProcessingAuth = useRef(false);

  useEffect(() => {
    setUsernameInput(userStats?.username || '');
  }, [userStats]);

  useEffect(() => {
    if (!address) return;

    const processOAuthLogin = async (session: any) => {
      if (isProcessingAuth.current) return;
      isProcessingAuth.current = true;

      const provider = session?.user?.app_metadata?.provider;

      // Handle Discord
      if (provider === 'discord') {
        try {
          const discordName = session.user.user_metadata.custom_claims?.global_name
            || session.user.user_metadata.name
            || session.user.user_metadata.full_name
            || 'Discord User';

          const { error } = await supabase
            .from('user_points')
            .update({ discord_connected: true, discord_username: discordName })
            .eq('wallet_address', address.toLowerCase());

          if (error) throw error;
          showToast('success', 'Discord linked successfully!');
          await fetchUserStats();
          await supabase.auth.signOut();
        } catch (error: any) {
          console.error('Error linking Discord:', error);
          showToast('error', 'Database Error', error.message || 'Failed to save Discord info.');
        } finally {
          setTimeout(() => { isProcessingAuth.current = false; }, 2000);
        }
      }

      // Handle Twitter
      if (provider === 'x') {
        try {
          const twitterName = session.user.user_metadata.user_name
            || session.user.user_metadata.name
            || 'Twitter User';
          const twitterUsername = `@${twitterName}`;

          const { error } = await supabase
            .from('user_points')
            .update({ twitter_connected: true, twitter_username: twitterUsername })
            .eq('wallet_address', address.toLowerCase());

          if (error) throw error;
          showToast('success', 'Twitter/X linked successfully!');
          await fetchUserStats();
          await supabase.auth.signOut();
        } catch (error: any) {
          console.error('Error linking Twitter:', error);
          showToast('error', 'Database Error', error.message || 'Failed to save Twitter info.');
        } finally {
          setTimeout(() => { isProcessingAuth.current = false; }, 2000);
        }
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) processOAuthLogin(session);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        processOAuthLogin(session);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [address]);

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
      });
      showToast('success', 'Profile settings saved');
      await fetchUserStats();
      setShowEditModal(false);
    } catch (e: any) {
      showToast('error', 'Failed to save');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleDiscordConnect = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'discord',
        options: { redirectTo: `${window.location.origin}/?tab=profile` },
      });
      if (error) throw error;
    } catch (e: any) {
      showToast('error', 'Could not reach Discord.');
    }
  };

  const handleTwitterConnect = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'x',
        options: { redirectTo: `${window.location.origin}/?tab=profile` },
      });
      if (error) throw error;
    } catch (e: any) {
      showToast('error', 'Could not reach Twitter/X.');
    }
  };

  const handleTelegramConnect = async (telegramUser: any) => {
    if (!address) return;
    try {
      const tUsername = telegramUser.username ? `@${telegramUser.username}` : telegramUser.first_name || 'Telegram User';
      const { error } = await supabase
        .from('user_points')
        .update({ telegram_connected: true, telegram_username: tUsername })
        .eq('wallet_address', address.toLowerCase());
      if (error) throw error;
      showToast('success', 'Telegram linked successfully!');
      await fetchUserStats();
    } catch (e: any) {
      console.error('Telegram link error:', e);
      showToast('error', 'Database Error', e.message || 'Telegram link failed');
    }
  };

  const executeUnlinkWallet = async () => {
    if (!address) return;
    setIsUnlinking(true);
    try {
      await supabase.from('user_points').delete().eq('wallet_address', address.toLowerCase());
      await supabase.from('user_read_state').delete().eq('wallet_address', address.toLowerCase());
      await supabase.from('profiles').delete().eq('wallet_address', address.toLowerCase());
      showToast('success', 'Account permanently deleted');
      setShowDeleteModal(false);
      disconnect();
    } catch (e) {
      showToast('error', 'Failed to delete account');
      setIsUnlinking(false);
    }
  };

  if (!address) return null;

  return (
    <div className="w-full animate-fade-in pb-8 space-y-4 relative flex flex-col items-center">

      {/* Top Banner */}
      <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-4">
          <ProfileAvatar />
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              {userStats?.username || 'Anonymous User'}
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs font-mono text-slate-500 dark:text-slate-400">{truncateAddress(address)}</p>
              <button onClick={() => handleCopyHash(address)} className="text-slate-400 hover:text-indigo-500 transition-colors" title="Copy Address">
                {copiedHash === address ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
              </button>
              <div className="w-px h-3 bg-slate-300 dark:bg-slate-700 mx-1"></div>
              <button
                onClick={() => setShowEditModal(true)}
                className="text-slate-400 hover:text-indigo-500 transition-colors flex items-center gap-1"
                title="Edit Username"
              >
                <Pencil size={12} />
                <span className="text-[9px] font-bold uppercase tracking-wider hidden sm:block">Edit Name</span>
              </button>
            </div>
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

      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm animate-fade-in mt-2">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
          <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Connected Accounts</h3>
          <p className="text-xs text-slate-500 mt-0.5">Link your social profiles and manage your Web3 wallets.</p>
        </div>
        <div className="p-4 sm:p-5 space-y-4">

          {/* Discord */}
          <div className="flex flex-col gap-2 pb-4 border-b border-slate-100 dark:border-slate-800/50">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#5865F2]/10 text-[#5865F2] flex items-center justify-center">
                  <DiscordIcon size={16} />
                </div>
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
              <button onClick={handleDiscordConnect} className="w-fit px-6 py-2 bg-[#5865F2] hover:bg-[#4752C4] text-white text-[11px] font-bold rounded-lg transition-colors shadow-sm mt-1">
                Connect Discord
              </button>
            )}
          </div>

          {/* Twitter / X */}
          <div className="flex flex-col gap-2 pb-4 border-b border-slate-100 dark:border-slate-800/50">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-black/10 dark:bg-white/10 text-black dark:text-white flex items-center justify-center">
                  <TwitterIcon size={16} />
                </div>
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">Twitter / X</span>
              </div>
              {userStats?.twitterConnected ? (
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-md">
                  {userStats?.twitterUsername || '@user'}
                </span>
              ) : (
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">Not Linked</span>
              )}
            </div>
            {!userStats?.twitterConnected && (
              <button onClick={handleTwitterConnect} className="w-fit px-6 py-2 bg-black hover:bg-zinc-800 text-white text-[11px] font-bold rounded-lg transition-colors shadow-sm mt-1 flex items-center gap-2">
                <TwitterIcon size={13} />
                Connect Twitter / X
              </button>
            )}
          </div>

          {/* Telegram */}
          <div className="flex flex-col gap-2 pb-4 border-b border-slate-100 dark:border-slate-800/50">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#24A1DE]/10 text-[#24A1DE] flex items-center justify-center">
                  <TelegramIcon size={16} />
                </div>
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">Telegram</span>
              </div>
              {userStats?.telegramConnected ? (
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-md">
                  {userStats?.telegramUsername || '@user123'}
                </span>
              ) : (
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">Not Linked</span>
              )}
            </div>
            {!userStats?.telegramConnected && (
              <TelegramAuthWidget
                botName="Custodex_Auth_Bot"
                onAuth={handleTelegramConnect}
              />
            )}
          </div>

          {/* Primary Wallet */}
          <div className="flex flex-col gap-2 pt-1">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mt-0.5">
                  <Wallet size={16} />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">Primary Wallet</span>
                  <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-0.5 break-all">{address}</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="w-fit px-6 py-2 border border-rose-300 dark:border-rose-700/50 text-rose-600 dark:text-rose-400 rounded-lg text-[11px] font-bold hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors flex justify-center items-center gap-2 mt-1"
            >
              Unlink Wallet
            </button>
          </div>

        </div>
      </div>

      {/* Edit Username Modal */}
      {showEditModal && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl ring-1 ring-black/5 dark:ring-white/5 border border-slate-200 dark:border-slate-800">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950/50">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Edit Username</h3>
                <p className="text-[10px] text-slate-500 mt-0.5">Customize your public display name.</p>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-md transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-5">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2"><UserPlus size={12} /> Display Name</label>
                <input
                  type="text"
                  placeholder="Enter a username..."
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  className="w-full bg-transparent border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                />
              </div>
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800/50">
                <button
                  onClick={handleSaveProfile}
                  disabled={isSavingProfile || usernameInput === userStats?.username || usernameInput.trim().length < 3}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-50 active:scale-95 flex items-center justify-center gap-2 shadow-sm"
                >
                  {isSavingProfile ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  {isSavingProfile ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation Modal */}
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