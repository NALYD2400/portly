import { readStoredSetting } from '../../services/settingsStorage';
import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, X, Zap, Info } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  useEffect(() => {
    const handleAddToast = (event) => {
     const { id = Date.now(), title, message, type = 'info', duration = 4000 } = event.detail || {};
     const newToast = { id, title, message, type };

      const isAppEnabled = readStoredSetting('notif_app') !== 'false';
     if (isAppEnabled) {
       setToasts((prev) => [...prev.filter(toast => toast.id !== id), newToast].slice(-4));
     }

      const isWindowsEnabled = readStoredSetting('notif_windows') !== 'false';
     if (isWindowsEnabled) {
       try {
         invoke('send_windows_notification', {
            title: title || 'Sprint Supervisor',
           body: message || '',
          }).catch(() => {});
        } catch (e) {
          console.error('Failed to send Windows native notification:', e);
        }
      }

      if (duration > 0) {
        clearTimeout(timers.current.get(id));
        timers.current.set(id, setTimeout(() => {
          timers.current.delete(id);
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, duration));
      }
    };

    window.addEventListener('portly-toast', handleAddToast);
    const activeTimers = timers.current;
    return () => {
      window.removeEventListener('portly-toast', handleAddToast);
      activeTimers.forEach(clearTimeout);
      activeTimers.clear();
    };
  }, []);

  const removeToast = (id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  const kinds = {
    success: { Icon: CheckCircle2, color: '#34d399' },
    warning: { Icon: AlertTriangle, color: '#fbbf24' },
    error: { Icon: XCircle, color: '#f87171' },
    info: { Icon: Info, color: '#60a5fa' },
  };

  return (
    <div style={{ zIndex: 'var(--layer-toast)', maxWidth: 'min(24rem, calc(100% - 40px))' }} className="fixed bottom-5 right-5 flex flex-col gap-2.5 pointer-events-none w-full">
      {toasts.map((toast) => {
        const { Icon, color } = kinds[toast.type] || { Icon: Zap, color: 'var(--accent-color)' };
        return (
          <div
            key={toast.id}
            role="status"
            className="pointer-events-auto relative overflow-hidden pl-4 pr-3 py-3 rounded-xl bg-[var(--surface-2)] border border-[var(--line-strong)] shadow-[0_12px_32px_-8px_rgba(0,0,0,0.7)] animate-slideUp flex items-start justify-between gap-3"
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <Icon className="w-4 h-4 mt-px shrink-0" style={{ color }} />
              <div className="min-w-0">
                <h4 className="text-[13px] font-medium text-zinc-100 truncate">{toast.title}</h4>
                {toast.message && (
                  <p className="text-xs text-zinc-400 mt-0.5 break-words leading-relaxed">{toast.message}</p>
                )}
              </div>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="p-1 rounded-md text-zinc-500 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
              aria-label="Fermer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
