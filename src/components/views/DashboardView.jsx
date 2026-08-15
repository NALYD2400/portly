import React from 'react';
import { Cpu, Activity, Zap, Square, ExternalLink, ArrowUpRight } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { triggerToast } from '../ui/ToastContainer';
import { markManualStop } from '../../hooks/useTauriIPC';

// Échelle de référence pour la barre RAM cumulative (2 Go)
const RAM_SCALE_MB = 2048;

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

  const handleStopServer = async (serverId, serverName) => {
    markManualStop(serverId);
    try {
      await invoke('stop_server_cmd', { serverId });
    } catch (e) {
      if (!String(e).includes("n'est pas en cours")) {
        triggerToast({
          title: '⚠️ Échec de l\'Arrêt',
          message: `Impossible d'arrêter ${serverName}: ${String(e)}`,
          type: 'error',
        });
      }
    }
  };

  const handleOpenBrowser = (url) =>
    invoke('open_browser', { url }).catch((e) =>
      triggerToast({ title: '⚠️ Navigateur', message: String(e), type: 'error' })
    );

  const ramPct = Math.min(100, ((metrics.managed_ram_mb || 0) / RAM_SCALE_MB) * 100);

  return (
    <div className="space-y-6 animate-fadeIn select-none pb-8">
      {/* Header Banner */}
      <div className="glass-panel p-6 rounded-3xl border theme-accent-border bg-gradient-to-r from-[#0d0b1a] via-[#120e29] to-[#0d0b1a] flex items-center justify-between shadow-2xl">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>Portly Supervisor</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full theme-accent-badge font-mono font-bold">
              Rust Engine Active
            </span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Mesure exclusive de la consommation CPU & RAM des serveurs lancés par Portly.
          </p>
        </div>
        <button
          onClick={() => onSelectTab('projects')}
          className="px-5 py-2.5 rounded-2xl theme-accent-btn text-white font-bold text-xs flex items-center gap-2 transition-all duration-200 cursor-pointer shadow-lg active:scale-95 hover:brightness-110 shrink-0"
        >
          <span>Gérer les Projets</span>
          <ArrowUpRight className="w-4 h-4" />
        </button>
      </div>

      {/* UNIFIED METRICS BENTO PANEL */}
      <div className="glass-panel rounded-3xl border border-white/10 p-6 shadow-2xl bg-gradient-to-br from-[#0e0c1f] via-[#130f2c] to-[#0e0c1f] relative overflow-hidden group">
        {/* Glow backdrop synchronisé avec l'accent */}
        <div
          className="pointer-events-none absolute -right-20 -top-20 w-80 h-80 rounded-full blur-3xl transition-all duration-500"
          style={{ background: 'rgba(var(--accent-color-rgb), 0.15)' }}
        />
        <div
          className="pointer-events-none absolute -left-20 -bottom-20 w-80 h-80 rounded-full blur-3xl transition-all duration-500"
          style={{ background: 'rgba(var(--accent-color-rgb), 0.15)' }}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-white/[0.08] relative z-10 gap-6 md:gap-0">
          {/* Module 1: CPU */}
          <div className="md:pr-6 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-300 font-bold uppercase tracking-wider font-mono flex items-center gap-2">
                <Cpu className="w-4 h-4 theme-accent-text" />
                <span>Consommation CPU</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full theme-accent-badge font-bold">
                Portly
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-white font-mono tracking-tight">
                {metrics.managed_cpu_pct ? metrics.managed_cpu_pct.toFixed(1) : '0.0'}%
              </span>
              <span className="text-xs text-gray-400 font-mono">CPU Total</span>
            </div>

            <p className="text-[11px] text-gray-400 font-mono">Total CPU utilisé par vos serveurs de dev</p>

            <div
              role="progressbar"
              aria-label="CPU total des serveurs"
              aria-valuenow={Math.round(metrics.managed_cpu_pct || 0)}
              aria-valuemin={0}
              aria-valuemax={100}
              className="w-full bg-black/50 h-2 rounded-full overflow-hidden border border-white/10 p-0.5"
            >
              <div
                className="theme-accent-btn h-full rounded-full transition-all duration-500 shadow-[0_0_10px_var(--accent-color)]"
                style={{ width: `${Math.min(100, metrics.managed_cpu_pct || 0)}%` }}
              />
            </div>
          </div>

          {/* Module 2: RAM */}
          <div className="md:px-6 pt-6 md:pt-0 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-300 font-bold uppercase tracking-wider font-mono flex items-center gap-2">
                <Activity className="w-4 h-4 theme-accent-text" />
                <span>Mémoire RAM (Cumulée)</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full theme-accent-badge font-bold">
                RAM
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-white font-mono tracking-tight">
                {metrics.managed_ram_mb ? metrics.managed_ram_mb.toFixed(1) : '0.0'}
              </span>
              <span className="text-xs theme-accent-text font-mono font-bold">MB</span>
            </div>

            <p className="text-[11px] text-gray-400 font-mono">Mémoire RAM cumulée de vos processus</p>

            <div
              role="progressbar"
              aria-label="RAM cumulée des serveurs"
              aria-valuenow={Math.round(ramPct)}
              aria-valuemin={0}
              aria-valuemax={100}
              title={`Échelle de référence : ${RAM_SCALE_MB / 1024} Go`}
              className="w-full bg-black/50 h-2 rounded-full overflow-hidden border border-white/10 p-0.5"
            >
              <div
                className="theme-accent-btn h-full rounded-full transition-all duration-500 shadow-[0_0_10px_var(--accent-color)]"
                style={{ width: `${ramPct}%` }}
              />
            </div>
          </div>

          {/* Module 3: Serveurs & Projets */}
          <div className="md:pl-6 pt-6 md:pt-0 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-300 font-bold uppercase tracking-wider font-mono flex items-center gap-2">
                <Zap className="w-4 h-4 theme-accent-text" />
                <span>Serveurs en Cours</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                En direct
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-white font-mono tracking-tight">
                {metrics.active_servers_count || 0}
              </span>
              <span className="text-xs text-gray-400 font-mono">serveurs / {totalProjects} projet(s)</span>
            </div>

            <p className="text-[11px] text-gray-400 font-mono">Processus de dev actifs en arrière-plan</p>

            <div
              role="progressbar"
              aria-label="Serveurs actifs"
              aria-valuenow={metrics.active_servers_count || 0}
              aria-valuemin={0}
              aria-valuemax={Math.max(1, totalProjects)}
              className="w-full bg-black/50 h-2 rounded-full overflow-hidden border border-white/10 p-0.5"
            >
              <div
                className="theme-accent-btn h-full rounded-full transition-all duration-500 shadow-[0_0_10px_var(--accent-color)]"
                style={{
                  width: totalProjects > 0 ? `${Math.min(100, ((metrics.active_servers_count || 0) / totalProjects) * 100)}%` : '0%',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Active Running Projects Detail Table */}
      <div className="glass-panel p-6 rounded-3xl space-y-4 border border-white/10 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3.5">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 tracking-tight">
            <Zap className="w-4 h-4 theme-accent-text" />
            <span>Processus & Serveurs Lancés en Temps Réel ({runningServersList.length})</span>
          </h2>
          <span className="text-[11px] text-gray-400 font-mono">Actualisation 2s</span>
        </div>

        {runningServersList.length === 0 ? (
          <div className="py-10 text-center text-gray-400 text-xs italic space-y-2">
            <div>Aucun serveur de dev n'est actuellement lancé.</div>
            <button
              onClick={() => onSelectTab('projects')}
              className="px-3.5 py-1.5 rounded-xl theme-accent-badge text-xs transition-colors cursor-pointer font-bold not-italic"
            >
              Lancer un serveur de projet →
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {runningServersList.map((srv) => (
              <div
                key={srv.id}
                className="glass-card p-4 rounded-2xl flex items-center justify-between border border-white/[0.08] hover-accent-border transition-all duration-200"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className="w-3.5 h-3.5 rounded-full shadow-lg shrink-0"
                    style={{
                      backgroundColor: srv.projectColor || 'var(--accent-color)',
                      boxShadow: `0 0 12px ${srv.projectColor || 'var(--accent-color)'}`,
                    }}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-white tracking-tight">{srv.projectName}</h3>
                      <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full theme-accent-badge">
                        {srv.name} (:{srv.port})
                      </span>
                      {srv.pid && (
                        <span className="text-[10px] font-mono text-gray-400 bg-white/[0.05] border border-white/10 px-2 py-0.5 rounded-full font-bold">
                          PID: {srv.pid}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-mono text-gray-400 mt-1 select-all truncate">{srv.command}</p>
                  </div>
                </div>

                {/* Per-process CPU & RAM consumption details */}
                <div className="flex items-center gap-5 shrink-0">
                  <div className="text-right">
                    <div className="text-xs font-extrabold theme-accent-text font-mono">
                      {srv.cpu_usage ? srv.cpu_usage.toFixed(1) : '0.0'}% CPU
                    </div>
                    <div className="text-[10px] text-gray-500 font-mono">Processeur</div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-extrabold theme-accent-text font-mono">
                      {srv.ram_mb ? srv.ram_mb.toFixed(1) : '0.0'} MB
                    </div>
                    <div className="text-[10px] text-gray-500 font-mono">RAM</div>
                  </div>

                  <div className="flex items-center gap-2 pl-3 border-l border-white/[0.08]">
                    {srv.port > 0 && (
                      <button
                        onClick={() => handleOpenBrowser(`http://localhost:${srv.port}`)}
                        className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.1] text-gray-300 hover:text-white border border-white/[0.08] transition-all cursor-pointer active:scale-95"
                        title="Ouvrir dans le navigateur"
                        aria-label="Ouvrir dans le navigateur"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      onClick={() => handleStopServer(srv.id, srv.name)}
                      className="px-3.5 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold text-xs flex items-center gap-1.5 border border-red-500/40 shadow-lg shadow-red-500/10 transition-all cursor-pointer active:scale-95"
                    >
                      <Square className="w-3.5 h-3.5 fill-red-400 text-red-400" />
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
