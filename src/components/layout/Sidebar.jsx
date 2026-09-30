import React from 'react';
import { LayoutDashboard, FolderCode, Network, Terminal, Settings, Download, Globe, Search } from 'lucide-react';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { id: 'projects', label: 'Projets', icon: FolderCode },
  { id: 'browser', label: 'Aperçu web', icon: Globe },
  { id: 'ports', label: 'Ports', icon: Network },
  { id: 'terminal', label: 'Logs', icon: Terminal },
];

function NavButton({ item, isActive, onClick, count, dot }) {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      className={`w-full flex items-center justify-between h-8 px-2.5 rounded-md text-[13px] transition-colors cursor-pointer ${
        isActive ? 'bg-white/[0.07] text-white' : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04]'
      }`}
    >
      <span className="flex items-center gap-2.5">
        <Icon className="w-4 h-4" strokeWidth={1.75} />
        <span>{item.label}</span>
      </span>
      {count ? <span className="text-xs font-mono text-zinc-500">{count}</span> : null}
      {dot ? <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> : null}
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
}) {
  return (
    <aside className="w-56 shrink-0 bg-[var(--surface-1)] px-3 pt-1 pb-3 flex flex-col justify-between select-none z-10">
      <div className="space-y-3">
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="w-full h-8 flex items-center justify-between gap-2 px-2.5 rounded-md bg-white/[0.04] hover:bg-white/[0.07] text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
          title="Rechercher ou exécuter une commande (Ctrl+K)"
        >
          <span className="flex items-center gap-2.5 text-[13px]">
            <Search className="w-4 h-4" strokeWidth={1.75} />
            Rechercher
          </span>
          <kbd className="font-mono text-[10px] text-zinc-600">Ctrl K</kbd>
        </button>

        <nav className="space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              isActive={activeTab === item.id}
              onClick={() => setActiveTab(item.id)}
              count={item.id === 'projects' && activeServersCount > 0 ? activeServersCount : null}
            />
          ))}
        </nav>
      </div>

      <div className="space-y-0.5">
        {updateAvailable && (
          <button
            onClick={onOpenUpdateModal}
            className="w-full flex items-center gap-2.5 h-8 px-2.5 rounded-md text-emerald-400 hover:bg-emerald-500/10 text-[13px] transition-colors cursor-pointer animate-fadeIn"
            title="Mise à jour disponible"
          >
            <Download className="w-4 h-4" strokeWidth={1.75} />
            <span>Mettre à jour</span>
          </button>
        )}
        <NavButton
          item={{ id: 'settings', label: 'Paramètres', icon: Settings }}
          isActive={activeTab === 'settings'}
          onClick={() => setActiveTab('settings')}
        />
      </div>
    </aside>
  );
}
