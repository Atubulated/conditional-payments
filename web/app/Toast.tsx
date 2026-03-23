'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle2, XCircle, Info, X, ExternalLink } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
  link?: string;
  linkText?: string;
}

interface ToastContextType {
  showToast: (type: ToastType, message: string, link?: string, linkText?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}

const TOAST_CONFIG = {
  success: {
    icon: CheckCircle2,
    bar: 'bg-emerald-500',
    iconColor: 'text-emerald-400',
    border: 'border-emerald-500/20',
  },
  error: {
    icon: XCircle,
    bar: 'bg-rose-500',
    iconColor: 'text-rose-400',
    border: 'border-rose-500/20',
  },
  info: {
    icon: Info,
    bar: 'bg-indigo-500',
    iconColor: 'text-indigo-400',
    border: 'border-indigo-500/20',
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((type: ToastType, message: string, link?: string, linkText?: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, message, link, linkText }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[999999] flex flex-col gap-2.5 pointer-events-none">
        {toasts.map((toast) => {
          const cfg = TOAST_CONFIG[toast.type];
          const Icon = cfg.icon;
          return (
            <div
              key={toast.id}
              className={`toast-enter pointer-events-auto relative overflow-hidden flex items-start gap-3 pl-4 pr-3 py-3 rounded-xl border ${cfg.border} bg-slate-900/95 backdrop-blur-xl min-w-[260px] max-w-[340px] shadow-[0_8px_32px_rgba(0,0,0,0.4)]`}
            >
              <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${cfg.bar} rounded-l-xl`} />
              <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${cfg.iconColor}`} />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-slate-100 leading-snug">{toast.message}</p>
                {toast.link && (
                  <a
                    href={toast.link}
                    target="_blank"
                    rel="noreferrer"
                    className={`mt-1 inline-flex items-center gap-1 text-[11px] font-bold ${cfg.iconColor} hover:opacity-80 transition-opacity`}
                  >
                    {toast.linkText || 'View'} <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="p-1 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <div className={`toast-progress absolute bottom-0 left-0 h-[2px] ${cfg.bar} opacity-40`} />
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}