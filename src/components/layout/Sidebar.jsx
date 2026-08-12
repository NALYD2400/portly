import React from 'react';
import { LayoutDashboard, FolderCode, Network, Terminal, Settings, Plus, Search } from 'lucide-react';

export default function Sidebar({
  activeTab,
  setActiveTab,
  activeServersCount,
  onAddProject,
  onOpenCommandPalette,
}) {
  const navItems = [
    { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
    { id: 'projects', label: 'Projets & Serveurs', icon: FolderCode, badge: activeServersCount > 0 ? activeServersCount : null },
    { id: 'ports', label: 'Inspecteur de Ports', icon: Network },
    { id: 'terminal', label: 'Logs Temps Réel', icon: Terminal },
  ];

  return (
    <aside className="w-60 h-[calc(100vh-2.5rem)] glass-panel border-r border-white/[0.08] p-3 flex flex-col justify-between select-none z-10">
      <div className="space-y-3">
        {/* Add Project Quick Button */}
        <button
          onClick={onAddProject}
          className="w-full py-2.5 px-3 rounded-xl theme-accent-btn text-white font-medium text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Nouveau Projet</span>
        </button>

        {/* Quick Command Center Search Button */}
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-gray-400 hover:text-white transition-all text-xs cursor-pointer group shadow-sm"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 theme-accent-text group-hover:scale-110 transition-transform" />
            <span className="text-[11px] font-medium">Rechercher...</span>
          </div>
          <kbd className="font-mono font-bold text-[9px] px-1.5 py-0.5 rounded theme-accent-badge">
            Ctrl K
          </kbd>
        </button>

        {/* Nav Links */}
        <nav className="space-y-1 pt-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer border ${
                  isActive
                    ? 'theme-accent-active font-bold border-white/20'
                    : 'border-transparent text-gray-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'theme-accent-text' : 'text-gray-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-green-500/20 text-green-400 font-mono border border-green-500/30">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Info */}
      <div className="pt-3 border-t border-white/[0.06]">
        <button
          onClick={() => setActiveTab('settings')}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer border ${
            activeTab === 'settings'
              ? 'theme-accent-active font-bold border-white/20'
              : 'border-transparent text-gray-400 hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Settings className={`w-4 h-4 ${activeTab === 'settings' ? 'theme-accent-text' : 'text-gray-400'}`} />
            <span>Paramètres</span>
          </div>
        </button>
      </div>
    </aside>
  );
}
