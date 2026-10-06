import React, { useState, useEffect, useMemo, useRef, useId } from 'react';
import {
  Search,
  FolderCode,
  Code2,
  ExternalLink,
  LayoutDashboard,
  Network,
  Terminal,
  Globe,
  Settings,
  Plus,
  Folder,
  CornerDownLeft,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import Modal from '../ui/Modal';
import { triggerToast } from '../../services/toastBus';

const normalize = (text) =>
  String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export default function CommandPaletteModal({
  isOpen,
  onClose,
  projects = [],
  onOpenTerminal,
  onSelectTab,
  onAddProject,
}) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const titleId = useId();
  const resultsId = useId();
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
    }
  }, [isOpen]);

  const items = useMemo(() => {
    const pages = [
      ['dashboard', 'Tableau de bord', 'Statistiques et serveurs', LayoutDashboard],
      ['projects', 'Projets', 'Gérer les projets et leurs commandes', FolderCode],
      ['browser', 'Aperçu web', 'Tester un site sur ordinateur, tablette ou mobile', Globe],
      ['ports', 'Ports', 'Voir les connexions et les processus', Network],
      ['terminal', 'Logs', 'Consulter les sorties des serveurs', Terminal],
      ['settings', 'Paramètres', 'Apparence, tableau de bord et préférences', Settings],
    ];
    const result = pages.map(([id, title, subtitle, icon]) => ({
      id: 'nav_' + id,
      group: 'pages',
      groupLabel: 'Pages',
      title,
      subtitle,
      icon,
      keywords: 'navigation',
      action: () => onSelectTab?.(id),
    }));
    result.push({
      id: 'add_project',
      group: 'actions',
      groupLabel: 'Actions',
      title: 'Ajouter un projet',
      subtitle: 'Choisir un dossier local',
      icon: Plus,
      action: () => onAddProject?.(),
    });
    projects.forEach((project) => {
      const group = 'project_' + project.id;
      const base = { group, groupLabel: project.name };
      result.push({
        ...base,
        id: 'code_' + project.id,
        title: 'Ouvrir dans VS Code',
        subtitle: project.root,
        keywords: 'editeur code',
        icon: Code2,
        action: () => invoke('open_vscode', { path: project.root }),
      });
      result.push({
        ...base,
        id: 'folder_' + project.id,
        title: 'Ouvrir le dossier',
        subtitle: project.root,
        keywords: 'explorateur fichiers',
        icon: Folder,
        action: () => invoke('open_explorer', { path: project.root }),
      });
      (project.servers || []).forEach((server) => {
        result.push({
          ...base,
          id: 'logs_' + server.id,
          title: 'Logs · ' + server.name,
          subtitle: server.port > 0 ? 'Port :' + server.port : 'Sorties du serveur',
          keywords: 'console terminal journal',
          icon: Terminal,
          action: () => onOpenTerminal?.(server.id, server.name),
        });
        if (server.port > 0)
          result.push({
            ...base,
            id: 'web_' + server.id,
            title: 'Ouvrir dans le navigateur',
            subtitle: server.name + ' · localhost:' + server.port,
            keywords: 'web site apercu navigateur',
            icon: ExternalLink,
            action: () => invoke('open_browser', { url: 'http://localhost:' + server.port }),
          });
      });
    });
    return result;
  }, [projects, onSelectTab, onAddProject, onOpenTerminal]);

  const filtered = useMemo(() => {
    const tokens = normalize(query).trim().split(/\s+/).filter(Boolean);
    return items.filter((item) => {
      const searchable = normalize(
        [item.title, item.subtitle, item.groupLabel, item.keywords].join(' '),
      );
      return tokens.every((token) => searchable.includes(token));
    });
  }, [items, query]);
  const selectedIndex = Math.min(activeIndex, Math.max(0, filtered.length - 1));
  const selected = filtered[selectedIndex];
  const groups = useMemo(() => {
    const map = new Map();
    filtered.forEach((item, index) => {
      if (!map.has(item.group))
        map.set(item.group, { id: item.group, label: item.groupLabel, items: [] });
      map.get(item.group).items.push({ ...item, index });
    });
    return [...map.values()];
  }, [filtered]);

  const execute = async (item) => {
    if (!item) return;
    onClose();
    try {
      await item.action();
    } catch (error) {
      triggerToast({ title: 'Action impossible', message: String(error), type: 'error' });
    }
  };
  const handleKeyDown = (event) => {
    if (event.nativeEvent.isComposing || !filtered.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((selectedIndex + 1) % filtered.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((selectedIndex + filtered.length - 1) % filtered.length);
    } else if (event.key === 'Home' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === 'End' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      setActiveIndex(filtered.length - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      execute(selected);
    }
  };
  useEffect(() => {
    if (!isOpen) return;
    listRef.current
      ?.querySelector('[data-index="' + selectedIndex + '"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex, query, isOpen]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      align="top"
      maxWidth="max-w-xl"
      labelledBy={titleId}
      panelClassName="command-palette-panel"
      backdropClassName="command-palette-backdrop"
    >
      <div className="command-palette" onKeyDown={handleKeyDown}>
        <h2 id={titleId} className="sr-only">
          Rechercher dans Sprint
        </h2>
        <div className="palette-search">
          <Search size={18} aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            placeholder="Rechercher un projet, une page, une commande…"
            aria-label="Recherche de commandes"
            role="combobox"
            aria-expanded={isOpen}
            aria-autocomplete="list"
            aria-controls={resultsId}
            aria-activedescendant={selected ? 'palette-' + selected.id : undefined}
          />
          <button
            type="button"
            className="palette-dismiss"
            aria-label="Fermer la recherche"
            onClick={onClose}
          >
            <kbd>Échap</kbd>
          </button>
        </div>
        <div
          id={resultsId}
          ref={listRef}
          role="listbox"
          aria-label="Résultats de recherche"
          className="palette-results"
        >
          {groups.length ? (
            groups.map((group) => (
              <div key={group.id} role="group" aria-label={group.label} className="palette-group">
                <div className="palette-group-label" aria-hidden="true">
                  {group.label}
                </div>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = item.index === selectedIndex;
                  return (
                    <button
                      type="button"
                      tabIndex={-1}
                      key={item.id}
                      id={'palette-' + item.id}
                      role="option"
                      aria-selected={active}
                      data-index={item.index}
                      onMouseMove={() => setActiveIndex(item.index)}
                      onClick={() => execute(item)}
                      className="palette-option"
                    >
                      <Icon size={17} className="palette-option-icon" aria-hidden="true" />
                      <span className="palette-option-copy">
                        <span className="palette-option-title">{item.title}</span>
                        <span className="palette-option-detail" title={item.subtitle}>
                          {item.subtitle}
                        </span>
                      </span>
                      {active && (
                        <CornerDownLeft size={14} className="palette-enter" aria-hidden="true" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          ) : (
            <div className="palette-empty">
              <Search size={22} aria-hidden="true" />
              <p>Aucun résultat pour « {query} »</p>
              <span>Essayez le nom d’un projet, une page ou un port.</span>
              <button
                type="button"
                className="quiet-button"
                onClick={() => {
                  setQuery('');
                  setActiveIndex(0);
                  inputRef.current?.focus();
                }}
              >
                Effacer la recherche
              </button>
            </div>
          )}
        </div>
        <div className="palette-footer">
          <span className="palette-count" role="status">
            {filtered.length} résultat{filtered.length > 1 ? 's' : ''}
          </span>
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> Naviguer
          </span>
          <span>
            <kbd>↵</kbd> Ouvrir
          </span>
        </div>
      </div>
    </Modal>
  );
}
