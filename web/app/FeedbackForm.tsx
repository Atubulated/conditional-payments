'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useAccount } from 'wagmi';
import { MessageSquarePlus, Loader2, X } from 'lucide-react';
import { useToast } from './Toast';

export default function FeedbackForm() {
  const { address } = useAccount();
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState('bug');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    const webhookUrl = process.env.NEXT_PUBLIC_DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
      showToast('error', 'Configuration Error', 'Discord webhook URL is missing.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        embeds: [{
          title: `New ${feedbackType.toUpperCase()} Report`,
          description: message,
          color: feedbackType === 'bug' ? 0xef4444 : feedbackType === 'feature' ? 0x3b82f6 : 0x10b981,
          fields: [
            { name: 'User Wallet', value: address || 'Not connected' }
          ],
          timestamp: new Date().toISOString()
        }]
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Failed to send');

      showToast('success', 'Feedback Sent!', 'Thank you for helping us improve.');
      setMessage('');
      setIsOpen(false);
    } catch (error) {
      showToast('error', 'Failed to send feedback.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* 1. The Fixed Floating Side Handle (Now with text!) */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-40 bg-indigo-600 hover:bg-indigo-700 text-white rounded-l-xl py-4 px-2 shadow-lg transition-all hover:-translate-x-1 flex flex-col items-center justify-center gap-3 border border-indigo-500/50 border-r-0 group"
        title="Submit Feedback"
      >
        <MessageSquarePlus size={18} className="drop-shadow-sm shrink-0" />
        <span className="text-[11px] font-bold tracking-[0.2em] uppercase [writing-mode:vertical-rl] rotate-180 shrink-0 opacity-90 group-hover:opacity-100">
          Feedback
        </span>
      </button>

      {/* 2. The Sleek Centered Modal */}
      {isOpen && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-[24px] w-full max-w-[380px] p-6 shadow-2xl relative animate-scale-in border border-slate-200/50 dark:border-slate-800">
            
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <MessageSquarePlus size={18} className="text-indigo-500" />
                <h2 className="text-[15px] font-bold tracking-tight">Submit Feedback</h2>
              </div>
              <button 
                onClick={() => setIsOpen(false)} 
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors bg-slate-50 dark:bg-slate-800 rounded-full p-1"
              >
                <X size={14} strokeWidth={3} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Type Toggles */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2.5">
                  Type
                </label>
                <div className="flex gap-2">
                  {['Bug', 'Feature', 'General'].map((type) => {
                    const typeLower = type.toLowerCase();
                    const isActive = feedbackType === typeLower;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setFeedbackType(typeLower)}
                        className={`flex-1 py-2 text-[11px] sm:text-xs font-bold rounded-xl border transition-all ${
                          isActive
                            ? 'border-indigo-200 bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:border-indigo-500/30 dark:text-indigo-400'
                            : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800'
                        }`}
                      >
                        {type}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Textarea */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2.5">
                  Message
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your experience..."
                  className="w-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-xl p-3.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all min-h-[120px] resize-none"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={!message.trim() || isSubmitting}
                className="w-full py-3.5 mt-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-bold text-[13px] tracking-wide transition-all disabled:opacity-50 active:scale-95 flex items-center justify-center gap-2 shadow-sm"
              >
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : null}
                {isSubmitting ? 'Sending...' : 'Send Feedback'}
              </button>
            </form>

          </div>
        </div>,
        document.body
      )}
    </>
  );
}