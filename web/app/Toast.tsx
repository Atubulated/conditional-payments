'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle2, XCircle, AlertCircle, X, ExternalLink } from 'lucide-react';

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
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((type: ToastType, message: string, link?: string, linkText?: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, message, link, linkText }]);

    // Auto remove after 10 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 10000);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toast Container */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`
              pointer-events-auto
              flex items-start gap-3 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-xl
              min-w-[280px] max-w-[380px]
              transform transition-all duration-300 ease-out
              animate-[slideIn_0.3s_ease-out]
              ${toast.type === 'success' ? 'bg-card border border-success/30 text-success' : ''}
              ${toast.type === 'error' ? 'bg-card border border-error/30 text-error' : ''}
              ${toast.type === 'info' ? 'bg-card border border-info/30 text-info' : ''}
            `}
            style={{
              boxShadow: toast.type === 'success'
                ? '0 0 20px rgba(34, 211, 238, 0.15)'
                : toast.type === 'error'
                  ? '0 0 20px rgba(239, 68, 68, 0.15)'
                  : '0 0 20px rgba(99, 102, 241, 0.15)'
            }}
          >
            {/* Icon */}
            <div className="mt-0.5">
              {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-success" />}
              {toast.type === 'error' && <XCircle className="w-5 h-5 text-error" />}
              {toast.type === 'info' && <AlertCircle className="w-5 h-5 text-info" />}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium">{toast.message}</span>

              {/* Optional Link */}
              {toast.link && (
                <a
                  href={toast.link}
                  target="_blank"
                  rel="noreferrer"
                  className={`
                    mt-1.5 flex items-center gap-1 text-xs font-medium
                    ${toast.type === 'success' ? 'text-success hover:text-success/80' : ''}
                    ${toast.type === 'error' ? 'text-error hover:text-error/80' : ''}
                    ${toast.type === 'info' ? 'text-info hover:text-info/80' : ''}
                    transition-colors
                  `}
                >
                  {toast.linkText || 'View'} <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            {/* Close Button */}
            <button
              onClick={() => removeToast(toast.id)}
              className="p-1 hover:bg-tertiary rounded-lg transition-colors text-text-muted hover:text-text-primary"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Keyframe animation */}
      <style jsx global>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(100px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </ToastContext.Provider>
  );
}