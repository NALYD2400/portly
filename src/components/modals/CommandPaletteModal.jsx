import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  FolderCode,
  Play,
  Square,
  Code2,
  ExternalLink,
  LayoutDashboard,
  Network,
  Terminal,
  Settings,
  Plus,
  Folder,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import Modal from '../ui/Modal';

export default function CommandPaletteModal({
  isOpen,
  onClose,
  projects,
  onOpenTerminal,
  onSelectTab,
  onAddProject,
}) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef(null);

  // Ctrl+K bascule la palette même quand elle est fermée
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && isOpen) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Réinitialise la recherche à chaque ouverture
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
    }
  }, [isOpen]);

  const items = useMemo(() => {
    const list = [
      {
        id: 'nav_dash',
        type: 'Navigation',
        title: "Tableau de bord (Vue d'ensemble)",
        subtitle: 'Statistiques CPU, RAM et processus actifs',
        action: () => onSelectTab && onSelectTab('dashboard'),
        icon: LayoutDashboard,
      },
      {
        id: 'nav_projects',
        type: 'Navigation',
        title: 'Projets & Serveurs',
        subtitle: 'Gestion des projets locaux et micro-services',
        action: () => onSelectTab && onSelectTab('projects'),
        icon: FolderCode,
      },
      {
        id: 'nav_ports',
        type: 'Navigation',
        title: 'Inspecteur de Ports',
        subtitle: 'Scan des ports occupés et libération de PID',
        action: () => onSelectTab && onSelectTab('ports'),
        icon: Network,
      },
      {
        id: 'nav_terminal',
        type: 'Navigation',
        title: 'Logs Temps Réel & Multi-Console',
        subtitle: 'Consoles de streaming des logs des serveurs',
        action: () => onSelectTab && onSelectTab('terminal'),
        icon: Terminal,
      },
      {
        id: 'nav_settings',
        type: 'Navigation',
        title: 'Paramètres & Personnalisation',
        subtitle: 'Couleurs #HEX, Systray et préférences système',
        action: () => onSelectTab && onSelectTab('settings'),
        icon: Settings,
      },
      {
        id: 'act_add_project',
        type: 'Action',
        title: 'Ajouter un Nouveau Projet',
        subtitle: 'Importer un dossier local avec détection de stack',
        action: () => onAddProject && onAddProject(),
        icon: Plus,
      },
    ];

    projects.forEach((p) => {
      list.push({
        id: `prj_code_${p.id}`,
        type: 'VS Code',
        title: `Ouvrir ${p.name} dans VS Code`,
        subtitle: p.root,
        action: () => invoke('open_vscode', { path: p.root }),
        icon: Code2,
      });

      list.push({
        id: `prj_exp_${p.id}`,
        type: 'Explorateur',
        title: `Ouvrir le dossier ${p.name}`,
        subtitle: p.root,
        action: () => invoke('open_explorer', { path: p.root }),
        icon: Folder,
      });

      (p.servers || []).forEach((srv) => {
        list.push({
          id: `srv_logs_${srv.id}`,
          type: 'Console Logs',
          title: `${p.name} - ${srv.name}`,
          subtitle: `Consulter les logs temps réel (Port :${srv.port})`,
          action: () => onOpenTerminal(srv.id, srv.name),
          icon: srv.state === 'running' ? Square : Play,
        });

        if (srv.port > 0) {
          list.push({
            id: `srv_web_${srv.id}`,
            type: 'Navigateur',
            title: `Ouvrir http://localhost:${srv.port}`,
            subtitle: `${p.name} - ${srv.name}`,
            action: () => invoke('open_browser', { url: `http://localhost:${srv.port}` }),
            icon: ExternalLink,
          });
        }
      });
    });

    return list;
  }, [projects, onSelectTab, onAddProject, onOpenTerminal]);

  const filteredItems = useMemo(() => {
    if (!query) return items;
    const q = query.toLowerCase();
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.type.toLowerCase().includes(q)
    );
  }, [items, query]);

  // Garde l'item actif dans les bornes quand la liste change
  useEffect(() => {
    setActiveIndex((prev) => Math.min(prev, Math.max(0, filteredItems.length - 1)));
  }, [filteredItems.length]);

  const executeItem = (item) => {
    item.action();
    onClose();
  };

  const handleKeyDown = (e) => {
    if (filteredItems.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % filteredItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActiveIndex(filteredItems.length - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      executeItem(filteredItems[activeIndex]);
    }
  };

  // Fait défiler pour garder l'item actif visible
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const active = list.querySelector(`[data-index="${activeIndex}"]`);
    if (active) {
      active.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} align="top" maxWidth="max-w-xl">
      <div
        onKeyDown={handleKeyDown}
        className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.08] bg-white/[0.02]"
      >
        <Search className="w-4 h-4 theme-accent-text" />
        <input
          type="text"
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(0);
          }}
          placeholder="Rechercher une vue, un projet, VS Code, un serveur ou un port..."
          aria-label="Recherche de commandes"
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-results"
          aria-activedescendant={filteredItems[activeIndex] ? `palette-item-${activeIndex}` : undefined}
          className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none"
        />
        <kbd className="font-mono text-[10px] px-2 py-0.5 rounded bg-black/40 text-gray-400 border border-white/10">
          ESC
        </kbd>
      </div>

      {/* Results List */}
      <div
        id="palette-results"
        ref={listRef}
        role="listbox"
        className="max-h-80 overflow-y-auto p-2 divide-y divide-white/[0.04]"
      >
        {filteredItems.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-500">Aucun résultat correspondant</div>
        ) : (
          filteredItems.map((item, idx) => {
            const Icon = item.icon;
            const isActive = idx === activeIndex;
            return (
              <button
                key={item.id}
                id={`palette-item-${idx}`}
                role="option"
                aria-selected={isActive}
                data-index={idx}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => executeItem(item)}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors text-left group cursor-pointer ${
                  isActive ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/[0.05] theme-accent-text flex items-center justify-center border border-white/[0.08]">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className={`text-xs font-semibold ${isActive ? 'theme-accent-text' : 'text-white'}`}>
                      {item.title}
                    </h4>
                    <p className="text-[11px] font-mono text-gray-400 truncate max-w-xs">{item.subtitle}</p>
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded theme-accent-badge font-mono">{item.type}</span>
              </button>
            );
          })
        )}
      </div>

      <div className="flex items-center gap-4 px-4 py-2 border-t border-white/[0.08] text-[10px] font-mono text-gray-500">
        <span>↑↓ naviguer</span>
        <span>↵ exécuter</span>
        <span>esc fermer</span>
      </div>
    </Modal>
  );
}
