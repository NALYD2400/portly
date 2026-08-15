import React from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import Modal from './Modal';

/**
 * Dialogue de confirmation réutilisable pour toutes les actions
 * destructives (suppression projet/serveur, kill de PID...).
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  danger = false,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal isOpen={open} onClose={onCancel} maxWidth="max-w-md">
      <div className="p-6 space-y-5">
        <div className="flex items-start gap-3.5">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
              danger
                ? 'bg-red-500/15 text-red-400 border-red-500/30'
                : 'bg-white/[0.05] text-gray-300 border-white/10'
            }`}
          >
            {danger ? <AlertTriangle className="w-5 h-5" /> : <HelpCircle className="w-5 h-5" />}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white tracking-tight">{title}</h3>
            <p className="text-xs text-gray-400 mt-1.5 leading-relaxed break-words">{message}</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-gray-300 hover:text-white text-xs font-semibold border border-white/10 transition-all cursor-pointer active:scale-95"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2.5 rounded-xl text-white text-xs font-bold flex items-center gap-2 shadow-lg transition-all cursor-pointer active:scale-95 ${
              danger
                ? 'bg-red-500/80 hover:bg-red-500 border border-red-400/40'
                : 'theme-accent-btn'
            }`}
          >
            {danger ? <AlertTriangle className="w-3.5 h-3.5" /> : null}
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
