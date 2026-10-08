import { readStoredSetting } from '../../services/settingsStorage';
import React, { useRef } from 'react';
import { Minus, Square, X } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

export default function TitleBar({ pageLabel, runningCount = 0 }) {
  const maximizePending = useRef(false);
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
    if (maximizePending.current) return;
    maximizePending.current = true;
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
    } catch {
      // The native window may be closing while the action is pending.
    } finally {
      maximizePending.current = false;
    }
  };

  const handleClose = async () => {
    const minimizeToTray = readStoredSetting('minimize_to_tray') !== 'false';
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

  const closeTitle =
    readStoredSetting('minimize_to_tray') !== 'false'
      ? 'Réduire dans la barre des tâches'
      : 'Quitter Sprint complètement';

  const ctl =
    'w-11 h-full flex items-center justify-center text-zinc-500 hover:text-white transition-colors cursor-pointer';

  return (
    <div
      data-tauri-drag-region
      className="h-9 shrink-0 w-full flex items-center justify-between pl-4 select-none z-50 text-xs cursor-default"
    >
      {/* Tauri handles dragging and double-click maximization on this region. */}
      <div data-tauri-drag-region className="flex items-center gap-2 pointer-events-none">
        {pageLabel && <span className="text-zinc-500 text-xs">{pageLabel}</span>}
        {runningCount > 0 && (
          <span className="ml-2 flex items-center gap-1.5 text-[12px] text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 live-dot" />
            {runningCount} en marche
          </span>
        )}
      </div>

      {/* Contrôles fenêtre */}
      <div className="flex items-stretch h-full">
        <button
          type="button"
          onClick={handleMinimize}
          className={`${ctl} hover:bg-white/[0.07]`}
          title="Réduire"
        >
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
        <button
          type="button"
          onClick={handleClose}
          className={`${ctl} hover:!bg-red-600 hover:!text-[#fff]`}
          title={closeTitle}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
