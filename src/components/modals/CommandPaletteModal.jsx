import React, { useState, useEffect } from 'react';
import { Search, FolderCode, Play, Square, Code2, ExternalLink, LayoutDashboard, Network, Terminal, Settings, Plus, Folder } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

export default function CommandPaletteModal({
  isOpen,
  onClose,
  projects,
  onOpenTerminal,
  onSelectTab,
  onAddProject,
}) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else setQuery('');
      } else if (isOpen && (e.key === 'Escape' || e.key === 'F5' || (e.ctrlKey && e.key === 'F5'))) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const items = [
    // Navigation Quick Items
    {
      id: 'nav_dash',
      type: 'Navigation',
      title: 'Tableau de bord (Vue d\'ensemble)',
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

    // Quick Action
    {
      id: 'act_add_project',
      type: 'Action',
      title: 'Ajouter un Nouveau Projet',
      subtitle: 'Importer un dossier local avec détection de stack',
      action: () => onAddProject && onAddProject(),
      icon: Plus,
    },
  ];

  // Dynamic Project & Server Items
  projects.forEach((p) => {
    items.push({
      id: `prj_code_${p.id}`,
      type: 'VS Code',
      title: `Ouvrir ${p.name} dans VS Code`,
      subtitle: p.root,
      action: () => invoke('open_vscode', { path: p.root }),
      icon: Code2,
    });

    items.push({
      id: `prj_exp_${p.id}`,
      type: 'Explorateur',
      title: `Ouvrir le dossier ${p.name}`,
      subtitle: p.root,
      action: () => invoke('open_explorer', { path: p.root }),
      icon: Folder,
    });

    (p.servers || []).forEach((srv) => {
      items.push({
        id: `srv_logs_${srv.id}`,
        type: 'Console Logs',
        title: `${p.name} - ${srv.name}`,
        subtitle: `Consulter les logs temps réel (Port :${srv.port})`,
        action: () => onOpenTerminal(srv.id, srv.name),
        icon: srv.state === 'running' ? Square : Play,
      });

      if (srv.port > 0) {
        items.push({
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

  const filteredItems = query
    ? items.filter(
        (item) =>
          item.title.toLowerCase().includes(query.toLowerCase()) ||
          item.subtitle.toLowerCase().includes(query.toLowerCase()) ||
          item.type.toLowerCase().includes(query.toLowerCase())
      )
    : items;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-start justify-center pt-20 p-4 select-none cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel w-full max-w-xl rounded-2xl border theme-accent-border shadow-2xl overflow-hidden animate-scaleUp cursor-default"
      >
        {/* Search Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.08] bg-white/[0.02]">
          <Search className="w-4 h-4 theme-accent-text" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une vue, un projet, VS Code, un serveur ou un port..."
            className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none"
          />
          <kbd className="font-mono text-[10px] px-2 py-0.5 rounded bg-black/40 text-gray-400 border border-white/10">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-white/[0.04]">
          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-500">Aucun résultat correspondant</div>
          ) : (
            filteredItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    item.action();
                    onClose();
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/[0.06] transition-colors text-left group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/[0.05] theme-accent-text flex items-center justify-center border border-white/[0.08]">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-white group-hover:theme-accent-text transition-colors">
                        {item.title}
                      </h4>
                      <p className="text-[11px] font-mono text-gray-400">{item.subtitle}</p>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded theme-accent-badge font-mono">
                    {item.type}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
