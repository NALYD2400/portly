import React from 'react';
import { Minus, Square, X, Terminal } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

export default function TitleBar() {
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
    } catch (e) {}
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
    } catch (e) {}
  };

  const handleClose = async () => {
    try {
      await invoke('hide_window_cmd');
    } catch (e) {
      try {
        const win = await getWin();
        if (win && typeof win.hide === 'function') {
          await win.hide();
        }
      } catch (err) {}
    }
  };

  const handleDoubleClick = async (e) => {
    if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
    await handleMaximize();
  };

  return (
    <div
      data-tauri-drag-region
      onDoubleClick={handleDoubleClick}
      className="h-10 w-full glass-panel flex items-center justify-between px-3.5 select-none border-b border-white/[0.08] z-50 text-xs text-gray-300 cursor-default bg-[#0b0c16]/90 backdrop-blur-xl"
    >
      {/* Brand & Logo */}
      <div data-tauri-drag-region className="flex items-center gap-2.5 pointer-events-none">
        <div className="w-5 h-5 rounded-md theme-accent-btn flex items-center justify-center shadow-lg">
          <Terminal className="w-3 h-3 text-white" />
        </div>
        <span className="font-bold tracking-wide text-white text-sm font-sans">Portly</span>
      </div>

      {/* Middle Drag Space */}
      <div data-tauri-drag-region className="flex-1 h-full" />

      {/* Window Action Buttons */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={handleMinimize}
          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
          title="Réduire"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={handleMaximize}
          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
          title="Agrandir / Restaurer"
        >
          <Square className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={handleClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-500/80 text-gray-400 hover:text-white transition-colors cursor-pointer"
          title="Réduire dans la barre des tâches"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
