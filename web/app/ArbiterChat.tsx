'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Send, Shield, Loader2, AlertCircle, Paperclip, X, FileText, Image as ImageIcon } from 'lucide-react';
import { supabase } from './supabaseClient';
import { useToast } from './Toast';

interface ChatMessage {
  id: string;
  payment_id: string;
  sender_address: string;
  message: string;
  file_url: string | null;
  created_at: string;
}

interface ArbiterChatProps {
  paymentId: string;
  currentUserAddress: string;
  arbiterAddress: string;
  senderAddress: string;
  receiverAddress: string;
  paymentStatus: number;
}

export default function ArbiterChat({ paymentId, currentUserAddress, arbiterAddress, senderAddress, receiverAddress, paymentStatus }: ArbiterChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  const currentAddressLower = currentUserAddress.toLowerCase();
  const arbiterAddressLower = arbiterAddress.toLowerCase();
  const senderAddressLower = senderAddress.toLowerCase();
  const receiverAddressLower = receiverAddress.toLowerCase();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    let isMounted = true;

    const fetchMessages = async () => {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('arbiter_chat')
          .select('*')
          .eq('payment_id', paymentId)
          .order('created_at', { ascending: true });

        if (error) throw error;
        if (isMounted && data) setMessages(data);
      } catch (error) {
        console.error('Error fetching chat:', error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchMessages();

    const channel = supabase
      .channel(`chat_payment_${paymentId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'arbiter_chat', filter: `payment_id=eq.${paymentId}` },
        (payload) => {
          if (isMounted) {
            setMessages((prev) => {
              if (prev.some(m => m.id === payload.new.id)) return prev;
              return [...prev, payload.new as ChatMessage];
            });
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [paymentId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) { 
        showToast('error', 'File too large', 'Please select a file under 5MB.');
        return;
      }
      setSelectedFile(file);
    }
  };

  const uploadFile = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
    const filePath = `${paymentId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('evidence')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('evidence').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() && !selectedFile) return;

    setIsSending(true);
    try {
      let fileUrl = null;
      
      if (selectedFile) {
        showToast('info', 'Uploading Evidence...', 'Please wait.');
        fileUrl = await uploadFile(selectedFile);
      }

      const defaultMessage = selectedFile ? `Uploaded evidence: ${selectedFile.name}` : '';

      const { data: insertedMessage, error } = await supabase.from('arbiter_chat').insert([
        {
          payment_id: paymentId,
          sender_address: currentAddressLower,
          message: newMessage.trim() || defaultMessage,
          file_url: fileUrl,
        },
      ]).select().single();

      if (error) throw error;
      
      if (insertedMessage) {
        setMessages((prev) => {
          if (prev.some(msg => msg.id === insertedMessage.id)) return prev;
          return [...prev, insertedMessage as ChatMessage];
        });
      }
      
      setNewMessage('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      console.error('Send error:', error);
      showToast('error', 'Failed to send message or upload file');
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (isLoading) {
    return (
      // SURGICAL FIX: Shrunk min height so it fits on landscape/short mobile screens
      <div className="flex flex-col items-center justify-center h-[80vh] min-h-[300px] max-h-[90vh] w-full bg-slate-50/50 dark:bg-slate-950/50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 dark:text-indigo-400 mb-4" />
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Syncing Room...</span>
      </div>
    );
  }

  return (
    // SURGICAL FIX: Allowed shrinking to 300px and limited max height to 90vh
    <div className="flex flex-col h-[80vh] max-h-[90vh] min-h-[300px] w-full bg-white dark:bg-slate-900 overflow-hidden animate-fade-in">
      <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-3.5">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-inner ${paymentStatus === 2 ? 'bg-gradient-to-br from-amber-50 dark:from-amber-900/30 to-amber-100 dark:to-amber-800/30 border border-amber-200 dark:border-amber-700/50 text-amber-600 dark:text-amber-500' : 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'}`}>
            <Shield size={20} className="drop-shadow-sm" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
              {paymentStatus === 2 ? 'Resolution Room' : 'Resolution Transcript'}
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium">
              {paymentStatus === 2 ? 'Upload proof and negotiate terms' : 'This dispute has been officially closed'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-[#F8FAFC] dark:bg-slate-950">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-60">
            <div className="w-16 h-16 rounded-full bg-slate-200/50 dark:bg-slate-800/50 flex items-center justify-center mb-2">
              <AlertCircle className="w-8 h-8 text-slate-400 dark:text-slate-500" />
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium max-w-[250px] leading-relaxed">
              {paymentStatus === 2 
                ? "The room is empty. State your case clearly and attach any relevant proof for the Arbiter." 
                : "No transcript available for this transaction."}
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const msgSenderLower = msg.sender_address.toLowerCase();
            const isMe = msgSenderLower === currentAddressLower;
            const isArbiterMsg = msgSenderLower === arbiterAddressLower;
            const isSenderMsg = msgSenderLower === senderAddressLower;
            const isReceiverMsg = msgSenderLower === receiverAddressLower;
            
            const isImage = msg.file_url?.match(/\.(jpeg|jpg|gif|png|webp)(\?.*)?$/i);
            const isVerdictMessage = msg.message.includes('VERDICT RENDERED');

            if (isVerdictMessage) {
              return (
                <div key={msg.id} className="w-full flex justify-center my-6">
                   <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-5 py-3 rounded-xl text-center shadow-sm max-w-[90%]">
                      <p className="text-[11px] font-extrabold text-emerald-800 dark:text-emerald-400 uppercase tracking-widest mb-1.5 flex items-center justify-center gap-1.5">
                        <Shield size={14} /> Official Verdict
                      </p>
                      <p className="text-[13px] text-emerald-700 dark:text-emerald-300 font-semibold leading-relaxed">
                        {msg.message.replace('VERDICT RENDERED: ', '')}
                      </p>
                   </div>
                </div>
              );
            }

            let myRole = '';
            if (currentAddressLower === senderAddressLower) myRole = 'Sender';
            else if (currentAddressLower === receiverAddressLower) myRole = 'Receiver';
            else if (currentAddressLower === arbiterAddressLower) myRole = 'Arbiter';

            let roleLabel = '';
            if (isArbiterMsg) roleLabel = 'Arbiter';
            else if (isSenderMsg) roleLabel = `Sender (${msg.sender_address.slice(0, 4)}...${msg.sender_address.slice(-4)})`;
            else if (isReceiverMsg) roleLabel = `Receiver (${msg.sender_address.slice(0, 4)}...${msg.sender_address.slice(-4)})`;
            else roleLabel = `User (${msg.sender_address.slice(0, 4)}...${msg.sender_address.slice(-4)})`;

            return (
              <div key={msg.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                {/* SURGICAL FIX: Expanded bubble max-width for better mobile reading */}
                <div className={`flex flex-col max-w-[90%] sm:max-w-[80%] ${isMe ? 'items-end' : 'items-start'}`}>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 px-1 flex items-center gap-1.5">
                    {isArbiterMsg && <Shield size={10} className="text-amber-500" />}
                    {isMe ? `You (${myRole})` : roleLabel}
                  </span>

                  <div
                    className={`px-4 py-3 text-[13px] sm:text-sm leading-relaxed ${
                      isMe
                        ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-sm shadow-md shadow-indigo-600/10'
                        : isArbiterMsg
                        ? 'bg-gradient-to-br from-amber-50 dark:from-amber-900/40 to-amber-100 dark:to-amber-800/40 border border-amber-200 dark:border-amber-700/50 text-amber-900 dark:text-amber-100 rounded-2xl rounded-tl-sm shadow-sm'
                        : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-2xl rounded-tl-sm shadow-sm'
                    }`}
                  >
                    {msg.message && <p className="whitespace-pre-wrap break-words">{msg.message}</p>}
                    
                    {msg.file_url && (
                      <div className={`mt-2 ${msg.message ? 'pt-3 border-t border-black/5 dark:border-white/5' : ''}`}>
                        {isImage ? (
                          <a href={msg.file_url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg border border-black/10 dark:border-white/10 shadow-sm hover:opacity-95 transition-opacity">
                            <img src={msg.file_url} alt="Evidence" className="max-w-full h-auto max-h-60 object-cover" />
                          </a>
                        ) : (
                          <a href={msg.file_url} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2.5 p-2.5 rounded-lg transition-all text-xs font-bold no-underline group ${isMe ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-sm'}`}>
                            <div className={`p-1.5 rounded-md ${isMe ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-500/20'}`}>
                              <FileText size={16} />
                            </div>
                            View Document
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <span className="text-[9px] text-slate-400 dark:text-slate-500 mt-1.5 px-1 font-semibold">
                    {formatTime(msg.created_at)}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {paymentStatus === 2 ? (
        <div className="bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 p-3 sm:p-4 flex flex-col shrink-0 z-10">
          {selectedFile && (
            <div className="mb-3 mx-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 font-semibold animate-fade-in shadow-sm">
              <span className="flex items-center gap-2 truncate pr-4">
                {selectedFile.type.startsWith('image/') ? <ImageIcon size={16} className="text-indigo-500" /> : <FileText size={16} className="text-indigo-500" />}
                <span className="truncate max-w-[200px]">{selectedFile.name}</span>
              </span>
              <button type="button" onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                <X size={14} strokeWidth={3} />
              </button>
            </div>
          )}

          <form onSubmit={handleSendMessage} className="relative flex items-end gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-[24px] p-1.5 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all shadow-inner dark:shadow-none">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept="image/*,application/pdf"
            />
            
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSending}
              className="w-10 h-10 rounded-full flex flex-shrink-0 items-center justify-center text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 transition-all disabled:opacity-50"
              title="Attach Evidence"
            >
              <Paperclip size={18} strokeWidth={2.5} />
            </button>

            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Message or paste evidence..."
              className="flex-1 bg-transparent py-2.5 px-2 text-[13px] sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none resize-none min-h-[40px] max-h-[120px] font-medium"
              rows={1}
              disabled={isSending}
              onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e);
                  }
              }}
            />
            <button
              type="submit"
              disabled={(!newMessage.trim() && !selectedFile) || isSending}
              className="w-10 h-10 rounded-full bg-indigo-600 text-white flex flex-shrink-0 items-center justify-center hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-600/20 active:scale-95"
            >
              {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 ml-0.5" strokeWidth={2.5} />}
            </button>
          </form>
        </div>
      ) : (
        <div className="bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 flex flex-col items-center justify-center shrink-0 z-10">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Shield size={14}/> Case Closed</p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 font-medium">This transcript is read-only and will be cleared shortly.</p>
        </div>
      )}
    </div>
  );
}