import React, { useState, useEffect } from 'react';
import { Terminal, Code2, Folder, Search, Settings, RefreshCw, Copy, Shield, Sparkles } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

export default function ContextMenu({ onOpenCommandPalette, onSelectTab }) {
  const [menuPos, setMenuPos] = useState(null);

  useEffect(() => {
    const handleContextMenu = (e) => {
      e.preventDefault();
      // Calculate pos so menu stays within viewport
      const x = Math.min(e.clientX, window.innerWidth - 220);
      const y = Math.min(e.clientY, window.innerHeight - 260);
      setMenuPos({ x, y });
    };

    const handleClick = () => setMenuPos(null);
    const handleScroll = () => setMenuPos(null);

    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('click', handleClick);
    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('click', handleClick);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  if (!menuPos) return null;

  return (
    <div
      style={{ top: `${menuPos.y}px`, left: `${menuPos.x}px` }}
      className="fixed z-[9999] w-52 glass-panel rounded-2xl p-1.5 border border-purple-500/30 shadow-2xl bg-[#0d0e1b]/95 backdrop-blur-xl animate-scaleUp text-xs font-sans select-none"
    >
      <div className="px-2 py-1 mb-1 text-[10px] font-mono text-purple-400 uppercase tracking-wider font-bold border-b border-white/[0.08] flex items-center gap-1.5">
        <Sparkles className="w-3 h-3 text-purple-400" />
        <span>Portly Quick Menu</span>
      </div>

      <button
        onClick={() => {
          onOpenCommandPalette();
          setMenuPos(null);
        }}
        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-purple-600/20 text-gray-200 hover:text-white transition-colors cursor-pointer text-left"
      >
        <div className="flex items-center gap-2">
          <Search className="w-3.5 h-3.5 text-purple-400" />
          <span>Recherche Rapide</span>
        </div>
        <kbd className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-black/40 text-gray-400">Ctrl+K</kbd>
      </button>

      <button
        onClick={() => {
          onSelectTab('projects');
          setMenuPos(null);
        }}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-purple-600/20 text-gray-200 hover:text-white transition-colors cursor-pointer text-left"
      >
        <Folder className="w-3.5 h-3.5 text-amber-400" />
        <span>Projets & Serveurs</span>
      </button>

      <button
        onClick={() => {
          onSelectTab('terminal');
          setMenuPos(null);
        }}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-purple-600/20 text-gray-200 hover:text-white transition-colors cursor-pointer text-left"
      >
        <Terminal className="w-3.5 h-3.5 text-emerald-400" />
        <span>Logs Temps Réel</span>
      </button>

      <div className="my-1 border-t border-white/[0.08]" />

      <button
        onClick={() => {
          onSelectTab('settings');
          setMenuPos(null);
        }}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-purple-600/20 text-gray-200 hover:text-white transition-colors cursor-pointer text-left"
      >
        <Settings className="w-3.5 h-3.5 text-cyan-400" />
        <span>Personnalisation & Paramètres</span>
      </button>
    </div>
  );
}
