import React from 'react';
import { Cpu, Activity, Zap, FolderCode, Play, Square, ExternalLink, Terminal, ArrowUpRight } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

export default function DashboardView({ metrics, projects, onSelectTab }) {
  const totalProjects = projects.length;
  const runningServersList = [];

  projects.forEach((p) => {
    (p.servers || []).forEach((srv) => {
      if (srv.state === 'running') {
        const serverMetric = (metrics.server_metrics || {})[srv.id] || {
          cpu_usage: 0,
          ram_mb: 0,
        };
        runningServersList.push({
          ...srv,
          projectName: p.name,
          projectColor: p.color,
          projectRoot: p.root,
          cpu_usage: serverMetric.cpu_usage,
          ram_mb: serverMetric.ram_mb,
        });
      }
    });
  });

  const handleStopServer = async (serverId) => {
    try {
      await invoke('stop_server_cmd', { serverId });
    } catch (e) {
      console.error('Error stopping server:', e);
    }
  };

  const handleOpenBrowser = (url) => invoke('open_browser', { url });

  return (
    <div className="space-y-6 animate-fadeIn select-none">
      {/* Header Banner */}
      <div className="glass-panel p-6 rounded-2xl border theme-accent-border bg-black/40 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>Portly Supervisor</span>
            <span className="text-xs px-2 py-0.5 rounded-full theme-accent-badge font-mono">
              Rust Engine Active
            </span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Mesure exclusive de la consommation CPU & RAM des serveurs lancés par Portly.
          </p>
        </div>
        <button
          onClick={() => onSelectTab('projects')}
          className="px-4 py-2 rounded-xl theme-accent-btn text-white font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <span>Gérer les Projets</span>
          <ArrowUpRight className="w-4 h-4" />
        </button>
      </div>

      {/* Metrics Cards Grid (Portly Managed Only) */}
      <div className="grid grid-cols-3 gap-4">
        {/* Managed CPU Card */}
        <div className="glass-card p-5 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-medium">Consommation CPU (Portly)</span>
            <Cpu className="w-4 h-4 theme-accent-text" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white font-mono">
              {metrics.managed_cpu_pct ? metrics.managed_cpu_pct.toFixed(1) : '0.0'}%
            </span>
          </div>
          <p className="text-[11px] text-gray-500 mt-1">Total CPU utilisé par vos serveurs de dev</p>
          <div className="w-full bg-black/40 h-1.5 rounded-full mt-3 overflow-hidden border border-white/5">
            <div
              className="theme-accent-btn h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, metrics.managed_cpu_pct || 0)}%` }}
            />
          </div>
        </div>

        {/* Managed RAM Card */}
        <div className="glass-card p-5 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-medium font-mono">Consommation RAM (Portly)</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white font-mono">
              {metrics.managed_ram_mb ? metrics.managed_ram_mb.toFixed(1) : '0.0'} MB
            </span>
          </div>
          <p className="text-[11px] text-gray-500 mt-1">Mémoire RAM cumulée de vos processus</p>
          <div className="w-full bg-black/40 h-1.5 rounded-full mt-3 overflow-hidden border border-white/5">
            <div
              className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (metrics.managed_ram_mb || 0) / 50)}%` }}
            />
          </div>
        </div>

        {/* Active Servers Card */}
        <div className="glass-card p-5 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-medium">Serveurs en Cours</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white font-mono">
              {metrics.active_servers_count || 0}
            </span>
            <span className="text-xs text-gray-400">/ {totalProjects} projets inscrits</span>
          </div>
          <p className="text-[11px] text-gray-500 mt-1">Processus de dev actifs en arrière-plan</p>
          <div className="w-full bg-black/40 h-1.5 rounded-full mt-3 overflow-hidden border border-white/5">
            <div
              className="bg-gradient-to-r from-amber-500 to-orange-400 h-full rounded-full transition-all duration-500"
              style={{ width: totalProjects > 0 ? `${((metrics.active_servers_count || 0) / totalProjects) * 100}%` : '0%' }}
            />
          </div>
        </div>
      </div>

      {/* Active Running Projects Detail Table */}
      <div className="glass-panel p-5 rounded-2xl space-y-4 border border-white/[0.08]">
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>Processus & Serveurs Lancés en Temps Réel ({runningServersList.length})</span>
          </h2>
          <span className="text-[10px] text-gray-400 font-mono">Actualisation toutes les 2s</span>
        </div>

        {runningServersList.length === 0 ? (
          <div className="py-10 text-center text-gray-500 text-xs italic space-y-2">
            <div>Aucun serveur de dev n'est actuellement lancé.</div>
            <button
              onClick={() => onSelectTab('projects')}
              className="px-3 py-1.5 rounded-lg theme-accent-badge text-xs transition-colors cursor-pointer"
            >
              Lancer un serveur de projet →
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {runningServersList.map((srv) => (
              <div
                key={srv.id}
                className="glass-card p-4 rounded-xl flex items-center justify-between border border-white/[0.06]"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full shadow-lg"
                    style={{ backgroundColor: srv.projectColor || '#a855f7' }}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold text-white">{srv.projectName}</h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded theme-accent-badge">
                        {srv.name} (:{srv.port})
                      </span>
                      {srv.pid && (
                        <span className="text-[10px] font-mono text-gray-400 bg-white/[0.05] px-1.5 py-0.2 rounded">
                          PID: {srv.pid}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-mono text-gray-400 mt-0.5">{srv.command}</p>
                  </div>
                </div>

                {/* Per-process CPU & RAM consumption details */}
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="text-xs font-bold theme-accent-text font-mono">
                      {srv.cpu_usage ? srv.cpu_usage.toFixed(1) : '0.0'}% CPU
                    </div>
                    <div className="text-[10px] text-gray-500">Utilisation Processeur</div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-bold text-cyan-300 font-mono">
                      {srv.ram_mb ? srv.ram_mb.toFixed(1) : '0.0'} MB
                    </div>
                    <div className="text-[10px] text-gray-500">Mémoire RAM</div>
                  </div>

                  <div className="flex items-center gap-1.5 pl-2 border-l border-white/[0.08]">
                    {srv.port > 0 && (
                      <button
                        onClick={() => handleOpenBrowser(`http://localhost:${srv.port}`)}
                        className="p-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-gray-300 hover:text-white transition-colors cursor-pointer"
                        title="Ouvrir dans le navigateur"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      onClick={() => handleStopServer(srv.id)}
                      className="px-2.5 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 font-medium text-xs flex items-center gap-1 border border-red-500/30 transition-colors cursor-pointer"
                    >
                      <Square className="w-3 h-3 fill-red-400 text-red-400" />
                      <span>Arrêter</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
