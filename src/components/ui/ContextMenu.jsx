import React, { useState, useEffect } from 'react';
import { Terminal, Folder, Search, Settings } from 'lucide-react';
import FloatingMenu from './FloatingMenu';

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
      if (isEditableTarget(e.target) || e.target.closest('[aria-modal="true"]')) return;
      e.preventDefault();
      setMenuPos({ x: e.clientX, y: e.clientY });
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
      label: 'Rechercher',
      kbd: 'Ctrl+K',
      action: onOpenCommandPalette,
    },
    {
      icon: Folder,
      label: 'Projets',
      action: () => onSelectTab('projects'),
    },
    {
      icon: Terminal,
      label: 'Logs',
      action: () => onSelectTab('terminal'),
    },
    {
      icon: Settings,
      label: 'Paramètres',
      action: () => onSelectTab('settings'),
    },
  ];

  return (
    <FloatingMenu
      point={menuPos}
      width={216}
      className="context-menu font-sans select-none"
    >
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
            className="context-menu-item"
          >
            <div className="flex items-center gap-2.5">
              <Icon size={15} strokeWidth={1.75} className="context-menu-icon" />
              <span>{item.label}</span>
            </div>
            {item.kbd && (
              <kbd className="context-menu-shortcut">
                {item.kbd}
              </kbd>
            )}
          </button>
        );
      })}
    </FloatingMenu>
  );
}
