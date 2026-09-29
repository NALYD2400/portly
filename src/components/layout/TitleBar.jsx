import React from 'react';
import { Minus, Square, X, Search } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

export default function TitleBar({ onOpenCommandPalette }) {
  const getWin = async () => {
    try {
      if (typeof window !== 'undefined' && (window.__TAURI_INTERNALS__ || window.__TAURI__)) {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        return getCurrentWindow();
      }
    } catch (e) {
      console.warn('Failed to get Tauri window:', e);
    }
    return null;
  };

  const handleMinimize = async () => {
    try {
      const win = await getWin();
      if (win) await win.minimize();
    } catch {}
  };

  const handleMaximize = async () => {
    try {
      const win = await getWin();
      if (win) {
        const isMax = await win.isMaximized();
        if (isMax) {
          await win.unmaximize();
        } else {
          await win.maximize();
        }
      }
    } catch {}
  };

  const handleClose = async () => {
    const minimizeToTray = localStorage.getItem('portly_cfg_minimizetotray') !== 'false';
    try {
      if (minimizeToTray) {
        // Masque dans le tray (réouverture via raccourci global ou icône tray)
        await invoke('hide_window_cmd');
      } else {
        // Fermeture complète : quitte et nettoie tous les process gérés
        await invoke('exit_app');
      }
    } catch {
      try {
        const win = await getWin();
        if (win && typeof win.hide === 'function') {
          await win.hide();
        }
      } catch {}
    }
  };

  const handleDoubleClick = async (e) => {
    if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
    await handleMaximize();
  };

  const closeTitle =
    localStorage.getItem('portly_cfg_minimizetotray') !== 'false'
      ? 'Réduire dans la barre des tâches'
      : 'Quitter Sprint complètement';

  const ctl =
    'w-11 h-full flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer';

  return (
    <div
      data-tauri-drag-region
      onDoubleClick={handleDoubleClick}
      className="h-9 w-full flex items-center justify-between pl-3.5 select-none border-b border-[var(--line)] bg-[var(--surface-1)] z-50 text-xs cursor-default"
    >
      {/* Marque */}
      <div data-tauri-drag-region className="flex items-center gap-2.5 pointer-events-none w-56">
        <img src="/icon.png" alt="" className="w-[18px] h-[18px] rounded-[5px] object-cover" />
        <span className="font-semibold tracking-tight text-zinc-100 text-[13px]">Sprint</span>
      </div>

      {/* Recherche / palette de commandes */}
      <div data-tauri-drag-region className="flex-1 h-full flex items-center justify-center px-4">
        {onOpenCommandPalette && (
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="flex items-center justify-between gap-3 h-7 px-2.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] border border-[var(--line)] hover:border-[var(--line-strong)] text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer w-72 max-w-full pointer-events-auto"
            title="Rechercher ou exécuter une commande (Ctrl+K)"
          >
            <span className="flex items-center gap-2 min-w-0">
              <Search className="w-3.5 h-3.5 shrink-0" />
              <span className="text-[12px] truncate">Rechercher une commande…</span>
            </span>
            <kbd className="font-mono text-[10px] px-1.5 py-px rounded bg-white/[0.06] text-zinc-500 border border-[var(--line)] shrink-0">
              Ctrl K
            </kbd>
          </button>
        )}
      </div>

      {/* Contrôles fenêtre */}
      <div className="flex items-stretch h-full">
        <button type="button" onClick={handleMinimize} className={`${ctl} hover:bg-white/[0.07]`} title="Réduire">
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={handleMaximize}
          className={`${ctl} hover:bg-white/[0.07]`}
          title="Agrandir / Restaurer"
        >
          <Square className="w-3 h-3" />
        </button>
        <button type="button" onClick={handleClose} className={`${ctl} hover:!bg-red-600`} title={closeTitle}>
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
