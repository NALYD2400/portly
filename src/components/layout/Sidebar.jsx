import React from 'react';
import { LayoutDashboard, FolderCode, Network, Terminal, Settings, Download, Globe } from 'lucide-react';

export default function Sidebar({
  activeTab,
  setActiveTab,
  activeServersCount,
  onOpenUpdateModal,
  updateAvailable,
}) {
  const navItems = [
    { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
    { id: 'projects', label: 'Projets & Serveurs', icon: FolderCode, badge: activeServersCount > 0 ? activeServersCount : null },
    { id: 'browser', label: 'Aperçu Web & Devices', icon: Globe },
    { id: 'ports', label: 'Inspecteur de Ports', icon: Network },
    { id: 'terminal', label: 'Logs Temps Réel', icon: Terminal },
  ];

  return (
    <aside className="w-60 h-[calc(100vh-2.5rem)] glass-panel border-r border-white/[0.08] p-3 flex flex-col justify-between select-none z-10">
      <div className="space-y-4">
        {/* Navigation Category Label */}
        <div className="px-2 pt-1 text-[10px] font-bold tracking-wider text-gray-500 uppercase font-mono">
          Navigation
        </div>

        {/* Nav Links */}
        <nav className="space-y-1.5">
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
      <div className="pt-3 border-t border-white/[0.06] space-y-1.5">
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

          {updateAvailable && (
            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              MAJ
            </span>
          )}
        </button>

       {updateAvailable && (
         <button
           onClick={onOpenUpdateModal}
           className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/30 transition-all cursor-pointer animate-fadeIn"
           title="Mise à jour disponible ! Cliquez pour télécharger."
         >
           <Download className="w-3.5 h-3.5 text-emerald-400" />
           <span>Mise à jour disponible</span>
         </button>
       )}
     </div>
   </aside>
  );
}
