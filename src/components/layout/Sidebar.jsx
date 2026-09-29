import React from 'react';
import { LayoutDashboard, FolderCode, Network, Terminal, Settings, Download, Globe } from 'lucide-react';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { id: 'projects', label: 'Projets & serveurs', icon: FolderCode },
  { id: 'browser', label: 'Aperçu web', icon: Globe },
  { id: 'ports', label: 'Ports', icon: Network },
  { id: 'terminal', label: 'Logs', icon: Terminal },
];

function NavButton({ item, isActive, onClick, badge, tag }) {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      className={`relative w-full flex items-center justify-between h-9 pl-3 pr-2.5 rounded-lg text-[13px] transition-colors cursor-pointer border ${
        isActive
          ? 'theme-accent-active font-medium'
          : 'border-transparent text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.045]'
      }`}
    >
      {isActive && (
        <span
          className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full"
          style={{ background: 'var(--accent-color)' }}
        />
      )}
      <span className="flex items-center gap-2.5">
        <Icon className={`w-[15px] h-[15px] ${isActive ? 'theme-accent-text' : 'text-zinc-500'}`} />
        <span>{item.label}</span>
      </span>
      {badge ? (
        <span className="min-w-5 h-5 px-1.5 inline-flex items-center justify-center rounded-md text-[11px] bg-emerald-500/12 text-emerald-400 font-mono font-medium border border-emerald-500/25">
          {badge}
        </span>
      ) : null}
      {tag ? (
        <span className="px-1.5 h-5 inline-flex items-center rounded-md text-[10px] font-semibold bg-emerald-500/12 text-emerald-400 border border-emerald-500/25">
          {tag}
        </span>
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
}) {
  return (
    <aside className="w-56 shrink-0 bg-[var(--surface-1)] border-r border-[var(--line)] p-3 flex flex-col justify-between select-none z-10">
      <div className="space-y-1">
        <div className="eyebrow px-3 pt-1 pb-2">Espace de travail</div>
        <nav className="space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              isActive={activeTab === item.id}
              onClick={() => setActiveTab(item.id)}
              badge={item.id === 'projects' && activeServersCount > 0 ? activeServersCount : null}
            />
          ))}
        </nav>
      </div>

      <div className="space-y-2">
        {updateAvailable && (
          <button
            onClick={onOpenUpdateModal}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-emerald-500/[0.08] hover:bg-emerald-500/15 text-emerald-300 text-xs font-medium border border-emerald-500/25 transition-colors cursor-pointer animate-fadeIn text-left"
            title="Mise à jour disponible"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Mise à jour disponible</span>
          </button>
        )}

        <div className="pt-2 border-t border-[var(--line)]">
          <NavButton
            item={{ id: 'settings', label: 'Paramètres', icon: Settings }}
            isActive={activeTab === 'settings'}
            onClick={() => setActiveTab('settings')}
            tag={updateAvailable ? 'MAJ' : null}
          />
        </div>
      </div>
    </aside>
  );
}
