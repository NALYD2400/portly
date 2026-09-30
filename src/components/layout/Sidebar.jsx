import React from 'react';
import {
  Home,
  FolderCode,
  Network,
  ScrollText,
  Settings,
  Download,
  Globe,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  HelpCircle,
} from 'lucide-react';

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Accueil', hint: 'Vue d’ensemble et lancement rapide', icon: Home, key: '1' },
  { id: 'projects', label: 'Projets', hint: 'Gérer vos projets et leurs commandes', icon: FolderCode, key: '2' },
  { id: 'browser', label: 'Aperçu', hint: 'Voir votre site sur ordinateur, tablette et mobile', icon: Globe, key: '3' },
  { id: 'ports', label: 'Connexions', hint: 'Qui utilise quel port réseau sur cet ordinateur', icon: Network, key: '4' },
  { id: 'terminal', label: 'Journal', hint: 'Ce que vos applications affichent en direct', icon: ScrollText, key: '5' },
];

function NavButton({ item, isActive, onClick, collapsed, badge, shortcut }) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      aria-label={collapsed ? item.label : undefined}
      title={collapsed ? `${item.label}${shortcut ? ` (Ctrl+${shortcut})` : ''}` : item.hint}
      className={`relative w-full flex items-center h-10 rounded-lg text-sm transition-colors cursor-pointer ${
        collapsed ? 'justify-center px-0' : 'gap-3 px-3'
      } ${
        isActive
          ? 'bg-[rgba(var(--accent-color-rgb),0.13)] text-zinc-50 font-medium'
          : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.05]'
      }`}
    >
      {isActive && (
        <span
          aria-hidden="true"
          className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full"
          style={{ backgroundColor: 'var(--accent-color)' }}
        />
      )}
      <Icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'theme-accent-text' : ''}`} strokeWidth={1.75} />
      {!collapsed && <span className="flex-1 text-left truncate">{item.label}</span>}
      {!collapsed && badge ? (
        <span className="min-w-5 h-5 px-1.5 rounded-full text-[11px] font-medium bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
          {badge}
        </span>
      ) : null}
      {collapsed && badge ? (
        <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-emerald-400" aria-hidden="true" />
      ) : null}
      {!collapsed && shortcut && !badge ? (
        <span className="text-[10px] font-mono text-zinc-600 opacity-0 group-hover/nav:opacity-100">^{shortcut}</span>
      ) : null}
    </button>
  );
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  activeServersCount,
  onOpenUpdateModal,
  updateAvailable,
  onOpenCommandPalette,
  onOpenHelp,
  collapsed,
  onToggleCollapsed,
}) {
  return (
    <aside
      className={`${
        collapsed ? 'w-[60px]' : 'w-60'
      } shrink-0 bg-[var(--surface-1)] px-2.5 pt-2 pb-3 flex flex-col justify-between select-none z-10 transition-[width] duration-200`}
      aria-label="Navigation principale"
    >
      <div className="space-y-4">
        <button
          type="button"
          onClick={onOpenCommandPalette}
          aria-label="Rechercher"
          className={`w-full h-10 flex items-center rounded-lg border border-[var(--line)] bg-[var(--surface-2)] hover:border-[var(--line-strong)] text-zinc-500 hover:text-zinc-200 transition-colors cursor-pointer ${
            collapsed ? 'justify-center' : 'justify-between px-3'
          }`}
          title="Rechercher un projet ou une page (Ctrl+K)"
        >
          <span className="flex items-center gap-2.5 text-sm">
            <Search className="w-[18px] h-[18px]" strokeWidth={1.75} />
            {!collapsed && 'Rechercher'}
          </span>
          {!collapsed && <kbd className="key">Ctrl K</kbd>}
        </button>

        <nav className="space-y-1" aria-label="Pages">
          {NAV_ITEMS.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              isActive={activeTab === item.id}
              onClick={() => setActiveTab(item.id)}
              collapsed={collapsed}
              shortcut={item.key}
              badge={item.id === 'projects' && activeServersCount > 0 ? activeServersCount : null}
            />
          ))}
        </nav>
      </div>

      <div className="space-y-1">
        {updateAvailable && (
          <button
            type="button"
            onClick={onOpenUpdateModal}
            className={`w-full flex items-center h-10 rounded-lg text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/15 text-sm transition-colors cursor-pointer animate-fadeIn ${
              collapsed ? 'justify-center' : 'gap-3 px-3'
            }`}
            title="Une nouvelle version est disponible"
            aria-label="Mettre à jour Sprint"
          >
            <Download className="w-[18px] h-[18px]" strokeWidth={1.75} />
            {!collapsed && <span>Mettre à jour</span>}
          </button>
        )}

        <button
          type="button"
          onClick={onOpenHelp}
          className={`w-full flex items-center h-10 rounded-lg text-sm text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.05] transition-colors cursor-pointer ${
            collapsed ? 'justify-center' : 'gap-3 px-3'
          }`}
          title="Aide et raccourcis (?)"
          aria-label="Aide et raccourcis"
        >
          <HelpCircle className="w-[18px] h-[18px]" strokeWidth={1.75} />
          {!collapsed && <span className="flex-1 text-left">Aide</span>}
          {!collapsed && <kbd className="key">?</kbd>}
        </button>

        <NavButton
          item={{ id: 'settings', label: 'Réglages', hint: 'Apparence, notifications et comportement', icon: Settings }}
          isActive={activeTab === 'settings'}
          onClick={() => setActiveTab('settings')}
          collapsed={collapsed}
        />

        <button
          type="button"
          onClick={onToggleCollapsed}
          className={`w-full flex items-center h-9 rounded-lg text-xs text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.05] transition-colors cursor-pointer ${
            collapsed ? 'justify-center' : 'gap-3 px-3'
          }`}
          title={collapsed ? 'Agrandir le menu (Ctrl+B)' : 'Réduire le menu (Ctrl+B)'}
          aria-label={collapsed ? 'Agrandir le menu' : 'Réduire le menu'}
          aria-expanded={!collapsed}
        >
          {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          {!collapsed && <span>Réduire le menu</span>}
        </button>
      </div>
    </aside>
  );
}
