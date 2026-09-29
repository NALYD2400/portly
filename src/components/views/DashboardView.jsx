import React from 'react';
import { Cpu, MemoryStick, Server, Square, ExternalLink, ArrowUpRight, Play } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { triggerToast } from '../../services/toastBus';
import { markManualStop } from '../../hooks/useTauriIPC';

// Échelle de référence pour la barre RAM cumulative (2 Go)
const RAM_SCALE_MB = 2048;

export default function DashboardView({ metrics, projects, onSelectTab, onOpenBrowser }) {
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
          title: "⚠️ Échec de l'Arrêt",
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

  const cpu = metrics.managed_cpu_pct || 0;
  const ram = metrics.managed_ram_mb || 0;
  const active = metrics.active_servers_count || 0;
  const activePct = totalProjects > 0 ? Math.min(100, (active / totalProjects) * 100) : 0;

  const stats = [
    {
      key: 'cpu',
      icon: Cpu,
      label: 'CPU',
      value: cpu.toFixed(1),
      unit: '%',
      hint: 'Cumulé sur vos serveurs',
      pct: Math.min(100, cpu),
      aria: 'CPU total des serveurs',
    },
    {
      key: 'ram',
      icon: MemoryStick,
      label: 'Mémoire',
      value: ram >= 1024 ? (ram / 1024).toFixed(2) : ram.toFixed(0),
      unit: ram >= 1024 ? 'Go' : 'Mo',
      hint: `Échelle de référence ${RAM_SCALE_MB / 1024} Go`,
      pct: ramPct,
      aria: 'RAM cumulée des serveurs',
    },
    {
      key: 'srv',
      icon: Server,
      label: 'Serveurs actifs',
      value: String(active),
      unit: `/ ${totalProjects} projet${totalProjects > 1 ? 's' : ''}`,
      hint: 'Processus lancés par Sprint',
      pct: activePct,
      aria: 'Serveurs actifs',
      live: active > 0,
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-7 animate-fadeIn select-none pb-8">
      {/* En-tête de page */}
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-50 tracking-tight">Tableau de bord</h1>
          <p className="text-[13px] text-zinc-500 mt-1">
            Consommation des serveurs lancés par Sprint, actualisée toutes les 2 secondes.
          </p>
        </div>
        <button
          onClick={() => onSelectTab('projects')}
          className="h-8 px-3.5 rounded-lg theme-accent-btn text-xs font-medium flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <span>Gérer les projets</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </header>

      {/* Indicateurs */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((st) => {
          const Icon = st.icon;
          return (
            <div key={st.key} className="glass-panel rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-medium text-zinc-400">
                  <Icon className="w-3.5 h-3.5 text-zinc-500" />
                  {st.label}
                </span>
                {st.live && (
                  <span className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 live-dot" />
                    En direct
                  </span>
                )}
              </div>

              <div className="flex items-baseline gap-1.5">
                <span className="stat-value text-[32px] leading-none font-semibold text-zinc-50">{st.value}</span>
                <span className="text-sm text-zinc-500 font-medium">{st.unit}</span>
              </div>

              <div className="space-y-2">
                <div
                  role="progressbar"
                  aria-label={st.aria}
                  aria-valuenow={Math.round(st.pct)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="meter"
                >
                  <span style={{ width: `${st.pct}%` }} />
                </div>
                <p className="text-[11px] text-zinc-500">{st.hint}</p>
              </div>
            </div>
          );
        })}
      </section>

      {/* Serveurs en cours */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
          Serveurs en cours
          <span className="min-w-5 h-5 px-1.5 inline-flex items-center justify-center rounded-md text-[11px] font-mono bg-white/[0.06] text-zinc-300">
            {runningServersList.length}
          </span>
        </h2>

        {runningServersList.length === 0 ? (
          <div className="glass-panel rounded-xl py-14 flex flex-col items-center text-center gap-3 border-dashed">
            <div className="w-10 h-10 rounded-lg bg-white/[0.04] flex items-center justify-center">
              <Server className="w-5 h-5 text-zinc-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-200">Aucun serveur en cours</p>
              <p className="text-xs text-zinc-500 mt-1">
                Lancez un serveur depuis vos projets pour suivre sa consommation ici.
              </p>
            </div>
            <button
              onClick={() => onSelectTab('projects')}
              className="h-8 px-3.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-zinc-200 text-xs font-medium border border-[var(--line-strong)] transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Play className="w-3 h-3" />
              Ouvrir les projets
            </button>
          </div>
        ) : (
          <div className="glass-panel rounded-xl divide-y divide-[var(--line)] overflow-hidden">
            {runningServersList.map((srv) => (
              <div
                key={srv.id}
                className="px-4 py-3.5 flex items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: srv.projectColor || 'var(--accent-color)' }}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-[13px] font-medium text-zinc-100">{srv.projectName}</h3>
                      <span className="text-[11px] font-mono px-1.5 py-px rounded-md bg-white/[0.06] text-zinc-300">
                        {srv.name}
                        {srv.port > 0 ? ` :${srv.port}` : ''}
                      </span>
                      {srv.pid && <span className="text-[11px] font-mono text-zinc-500">PID {srv.pid}</span>}
                    </div>
                    <p className="text-[11px] font-mono text-zinc-500 mt-1 select-all truncate">{srv.command}</p>
                  </div>
                </div>

                <div className="flex items-center gap-6 shrink-0">
                  <div className="text-right w-16">
                    <div className="stat-value text-[13px] text-zinc-100">
                      {srv.cpu_usage ? srv.cpu_usage.toFixed(1) : '0.0'}%
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">CPU</div>
                  </div>
                  <div className="text-right w-20">
                    <div className="stat-value text-[13px] text-zinc-100">
                      {srv.ram_mb ? srv.ram_mb.toFixed(0) : '0'} Mo
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">RAM</div>
                  </div>

                  <div className="flex items-center gap-1.5 pl-4 border-l border-[var(--line)]">
                    {srv.port > 0 && (
                      <button
                        onClick={() => {
                          if (onOpenBrowser) {
                            onOpenBrowser(srv.id, `http://localhost:${srv.port}`);
                          } else {
                            handleOpenBrowser(`http://localhost:${srv.port}`);
                          }
                        }}
                        className="h-8 w-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.09] text-zinc-400 hover:text-white border border-[var(--line)] transition-colors cursor-pointer flex items-center justify-center"
                        title="Ouvrir dans l'aperçu web"
                        aria-label="Aperçu web"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => handleStopServer(srv.id, srv.name)}
                      className="h-8 px-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 text-xs font-medium flex items-center gap-1.5 border border-red-500/25 transition-colors cursor-pointer"
                    >
                      <Square className="w-3 h-3 fill-current" />
                      <span>Arrêter</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
