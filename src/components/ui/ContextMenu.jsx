import React, { useState, useEffect } from 'react';
import { Terminal, Folder, Search, Settings, Sparkles } from 'lucide-react';

function isEditableTarget(target) {
  if (!target) return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  );
}

export default function ContextMenu({ onOpenCommandPalette, onSelectTab }) {
  const [menuPos, setMenuPos] = useState(null);

  useEffect(() => {
    const handleContextMenu = (e) => {
      // Ne pirate pas le clic droit natif dans les champs de saisie
      // (copier/coller doit rester possible dans les inputs et .env)
      if (isEditableTarget(e.target)) return;
      e.preventDefault();
      // Calculate pos so menu stays within viewport
      const x = Math.min(e.clientX, window.innerWidth - 220);
      const y = Math.min(e.clientY, window.innerHeight - 260);
      setMenuPos({ x, y });
    };

    const handleClick = () => setMenuPos(null);
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setMenuPos(null);
    };
    const handleScroll = () => setMenuPos(null);

    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('click', handleClick);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, []);

  if (!menuPos) return null;

  const items = [
    {
      icon: Search,
      iconClass: 'theme-accent-text',
      label: 'Recherche Rapide',
      kbd: 'Ctrl+K',
      action: onOpenCommandPalette,
    },
    {
      icon: Folder,
      iconClass: 'text-amber-400',
      label: 'Projets & Serveurs',
      action: () => onSelectTab('projects'),
    },
    {
      icon: Terminal,
      iconClass: 'text-emerald-400',
      label: 'Logs Temps Réel',
      action: () => onSelectTab('terminal'),
    },
    {
      icon: Settings,
      iconClass: 'text-cyan-400',
      label: 'Personnalisation & Paramètres',
      action: () => onSelectTab('settings'),
    },
  ];

  return (
    <div
      style={{ top: `${menuPos.y}px`, left: `${menuPos.x}px` }}
      className="fixed z-[9999] w-52 modal-panel !rounded-2xl p-1.5 animate-scaleUp text-xs font-sans select-none"
      role="menu"
    >
      <div className="px-2 py-1 mb-1 text-[10px] font-mono theme-accent-text uppercase tracking-wider font-bold border-b border-white/[0.08] flex items-center gap-1.5">
        <Sparkles className="w-3 h-3" />
        <span>Portly Quick Menu</span>
      </div>

      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.label}
            role="menuitem"
            onClick={() => {
              item.action();
              setMenuPos(null);
            }}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl hover-accent-bg text-gray-200 hover:text-white transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-2">
              <Icon className={`w-3.5 h-3.5 ${item.iconClass}`} />
              <span>{item.label}</span>
            </div>
            {item.kbd && (
              <kbd className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-black/40 text-gray-400">
                {item.kbd}
              </kbd>
            )}
          </button>
        );
      })}
    </div>
  );
}
