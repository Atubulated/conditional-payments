'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { Camera, Loader2, User } from 'lucide-react';
import { supabase } from './supabaseClient'; 
import { useToast } from './Toast';

export default function ProfileAvatar() {
  const { address, isConnected } = useAccount();
  const { showToast } = useToast();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch the user's existing avatar when their wallet connects
  useEffect(() => {
    if (!address) {
      setAvatarUrl(null);
      setIsLoading(false);
      return;
    }
    
    const fetchAvatar = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('avatar_url')
          .eq('wallet_address', address.toLowerCase())
          .single();

        // Error code PGRST116 just means "no rows found" (they are a new user), which is fine.
        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching avatar:', error);
        } else if (data?.avatar_url) {
          setAvatarUrl(data.avatar_url);
        }
      } catch (err) {
        console.error('Unexpected error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAvatar();
  }, [address]);

  // Handle the file selection and Supabase upload
  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setIsUploading(true);
      const file = event.target.files?.[0];
      if (!file || !address) return;

      // Security & UX: Limit file size to 2MB
      if (file.size > 2 * 1024 * 1024) {
        showToast('error', 'File too large', 'Please select an image under 2MB.');
        return;
      }

      // Create a unique file name using their wallet address and a timestamp
      const fileExt = file.name.split('.').pop();
      const fileName = `${address.toLowerCase()}-${Date.now()}.${fileExt}`;

      // 1. Upload the image to the 'avatars' storage bucket
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // 2. Get the public URL of the uploaded image
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // 3. Upsert (Update or Insert) the user's profile row in the database
      const { error: updateError } = await supabase
        .from('profiles')
        .upsert({ 
          wallet_address: address.toLowerCase(), 
          avatar_url: publicUrl,
        });

      if (updateError) throw updateError;

      // ✅ NEW: Tell the Quest system (user_points) that the avatar is set!
      await supabase.from('user_points').update({ avatar_id: 1 }).eq('wallet_address', address.toLowerCase());
      window.dispatchEvent(new Event('xp-updated')); // Forces Quests.tsx to immediately recognize it

      // 4. Update the UI and notify the user
      setAvatarUrl(publicUrl);
      showToast('success', 'Profile Updated', 'Your avatar looks great!');
    } catch (error: any) {
      console.error('Upload error:', error);
      showToast('error', 'Upload Failed', error.message || 'Could not upload avatar.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = ''; // Reset the hidden input
    }
  };

  // If they haven't connected their wallet, don't show the avatar component at all
  if (!isConnected) return null;

  return (
    <div className="relative group inline-block">
      {/* The Avatar Circle */}
      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-900 border-2 border-indigo-500/30 shadow-sm flex items-center justify-center relative transition-all group-hover:border-indigo-500/60">
        {isLoading ? (
          <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
        ) : avatarUrl ? (
          <img src={avatarUrl} alt="Profile Avatar" className="w-full h-full object-cover" />
        ) : (
          <User className="w-8 h-8 text-slate-400 dark:text-slate-600" />
        )}
        
        {/* The Hover Overlay (Click to Upload) */}
        <div 
          className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer backdrop-blur-[1px]"
          onClick={() => fileInputRef.current?.click()}
          title="Change Profile Picture"
        >
          {isUploading ? (
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          ) : (
            <Camera className="w-6 h-6 text-white" />
          )}
        </div>
      </div>

      {/* The Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleUpload}
        accept="image/png, image/jpeg, image/gif, image/webp"
        className="hidden"
        disabled={isUploading}
      />
    </div>
  );
}