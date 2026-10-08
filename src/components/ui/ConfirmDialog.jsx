import React, { useState } from 'react';
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
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    try { await onConfirm(); } finally { setBusy(false); }
  };
  return (
    <Modal isOpen={open} onClose={onCancel} dismissible={!busy} maxWidth="max-w-md">
      <div className="p-5 space-y-5">
        <div className="flex items-start gap-3.5">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              danger ? 'bg-red-500/12 text-red-400' : 'bg-white/[0.06] text-zinc-300'
            }`}
          >
            {danger ? <AlertTriangle className="w-[18px] h-[18px]" /> : <HelpCircle className="w-[18px] h-[18px]" />}
          </div>
          <div className="min-w-0 pt-0.5">
            <h3 className="text-sm font-semibold text-zinc-50">{title}</h3>
            <p className="text-[13px] text-zinc-400 mt-1 leading-relaxed break-words">{message}</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="h-8 px-3.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.09] text-zinc-300 hover:text-white text-xs font-medium border border-[var(--line)] transition-colors cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={busy}
            className={`h-8 px-3.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              danger ? 'bg-red-600 hover:bg-red-500 text-[#fff]' : 'theme-accent-btn text-white'
            }`}
          >
            {busy ? 'En cours…' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
