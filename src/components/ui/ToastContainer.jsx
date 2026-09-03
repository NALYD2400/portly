import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, X, Zap, Info } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handleAddToast = (event) => {
     const { id = Date.now(), title, message, type = 'info', duration = 4000 } = event.detail || {};
     const newToast = { id, title, message, type };

      const isAppEnabled = (localStorage.getItem('sprint_cfg_notif_app') ?? localStorage.getItem('portly_cfg_notif_app')) !== 'false';
     if (isAppEnabled) {
       setToasts((prev) => [...prev, newToast]);
     }

      const isWindowsEnabled = (localStorage.getItem('sprint_cfg_notif_windows') ?? localStorage.getItem('portly_cfg_notif_windows')) !== 'false';
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
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, duration);
      }
    };

    window.addEventListener('portly-toast', handleAddToast);
    return () => window.removeEventListener('portly-toast', handleAddToast);
  }, []);

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col space-y-3 pointer-events-none max-w-sm w-full">
      {toasts.map((toast) => {
        let borderStyle = {
          borderColor: 'rgba(var(--accent-color-rgb), 0.45)',
          boxShadow: '0 0 20px rgba(var(--accent-color-rgb), 0.25)',
        };
        let Icon = Zap;
        let iconClass = 'theme-accent-text';

        if (toast.type === 'success') {
          borderStyle = {
            borderColor: 'rgba(var(--accent-color-rgb), 0.5)',
            boxShadow: '0 0 20px rgba(var(--accent-color-rgb), 0.3)',
          };
          Icon = CheckCircle2;
          iconClass = 'theme-accent-text';
        } else if (toast.type === 'warning') {
          borderStyle = {
            borderColor: 'rgba(245, 158, 11, 0.5)',
            boxShadow: '0 0 20px rgba(245, 158, 11, 0.3)',
          };
          Icon = AlertTriangle;
          iconClass = 'text-amber-400';
        } else if (toast.type === 'error') {
          borderStyle = {
            borderColor: 'rgba(239, 68, 68, 0.5)',
            boxShadow: '0 0 20px rgba(239, 68, 68, 0.3)',
          };
          Icon = XCircle;
          iconClass = 'text-red-400';
        } else if (toast.type === 'info') {
          borderStyle = {
            borderColor: 'rgba(59, 130, 246, 0.5)',
            boxShadow: '0 0 20px rgba(59, 130, 246, 0.3)',
          };
          Icon = Info;
          iconClass = 'text-blue-400';
        }

        return (
          <div
            key={toast.id}
            style={borderStyle}
            className="pointer-events-auto p-4 rounded-2xl glass-card border bg-[#110e24]/95 backdrop-blur-xl shadow-2xl transition-all duration-300 animate-slideUp flex items-start justify-between gap-3"
          >
            <div className="flex items-start gap-3 min-w-0">
              <div className="p-2 rounded-xl bg-white/[0.05] border border-white/10 shrink-0">
                <Icon className={`w-4 h-4 ${iconClass}`} />
              </div>

              <div className="min-w-0">
                <h4 className="text-xs font-bold text-white tracking-tight truncate">{toast.title}</h4>
                {toast.message && <p className="text-[11px] font-mono text-gray-300 mt-0.5 break-words">{toast.message}</p>}
              </div>
            </div>

            <button
              onClick={() => removeToast(toast.id)}
              className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
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
