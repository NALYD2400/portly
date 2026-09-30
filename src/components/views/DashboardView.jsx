import React from 'react';
import { Square, ExternalLink, Plus } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { triggerToast } from '../../services/toastBus';
import { markManualStop } from '../../hooks/useTauriIPC';

export default function DashboardView({ metrics, projects, onSelectTab, onOpenBrowser, onAddProject }) {
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

  const cpu = metrics.managed_cpu_pct || 0;
  const ram = metrics.managed_ram_mb || 0;
  const active = metrics.active_servers_count || 0;
  const activePct = totalProjects > 0 ? Math.min(100, (active / totalProjects) * 100) : 0;

  const stats = [
    { label: 'Serveurs actifs', value: String(active), unit: `sur ${totalProjects} projet${totalProjects > 1 ? 's' : ''}` },
    { label: 'Processeur', value: cpu.toFixed(1), unit: '%' },
    {
      label: 'Mémoire',
      value: ram >= 1024 ? (ram / 1024).toFixed(1) : ram.toFixed(0),
      unit: ram >= 1024 ? 'Go' : 'Mo',
    },
  ];

  // Aucun projet : un seul appel à l'action, clair pour un premier lancement
  if (totalProjects === 0) {
    return (
      <div className="max-w-md mx-auto pt-24 text-center space-y-5 animate-fadeIn select-none">
        <h1 className="text-2xl font-semibold text-zinc-50 tracking-tight">Bienvenue dans Sprint</h1>
        <p className="text-sm text-zinc-500 leading-relaxed">
          Ajoutez le dossier d'un projet. Sprint détecte comment le lancer et vous permet de le démarrer,
          l'arrêter et voir ses logs en un clic.
        </p>
        <button
          onClick={() => (onAddProject ? onAddProject() : onSelectTab('projects'))}
          className="h-9 px-4 rounded-md theme-accent-btn text-sm font-medium inline-flex items-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Ajouter mon premier projet
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto animate-fadeIn select-none pb-8">
      <header className="mb-8">
        <h1 className="text-[22px] font-semibold text-zinc-50 tracking-tight">Tableau de bord</h1>
        <p className="text-[13px] text-zinc-500 mt-1">
          {active > 0
            ? `${active} serveur${active > 1 ? 's' : ''} en cours d'exécution.`
            : 'Rien ne tourne pour le moment.'}
        </p>
      </header>

      {/* Chiffres clés : pas de cartes, juste des valeurs lisibles */}
      <section className="grid grid-cols-3 gap-8 pb-8 mb-8 border-b border-[var(--line)]">
        {stats.map((st) => (
          <div key={st.label}>
            <p className="text-xs text-zinc-500">{st.label}</p>
            <p className="mt-2 flex items-baseline gap-1.5">
              <span className="stat-value text-[30px] leading-none font-medium text-zinc-50">{st.value}</span>
              <span className="text-sm text-zinc-500">{st.unit}</span>
            </p>
          </div>
        ))}
      </section>

      <section>
        <h2 className="text-sm font-medium text-zinc-300 mb-2">En cours</h2>

        {runningServersList.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-zinc-400">Aucun serveur lancé.</p>
            <button
              onClick={() => onSelectTab('projects')}
              className="mt-3 h-8 px-3 rounded-md text-xs text-zinc-300 bg-white/[0.05] hover:bg-white/[0.09] transition-colors cursor-pointer"
            >
              Aller aux projets
            </button>
          </div>
        ) : (
          <div>
            {runningServersList.map((srv) => (
              <div
                key={srv.id}
                className="flex items-center justify-between gap-4 h-12 px-3 -mx-3 rounded-lg hover:bg-white/[0.03] transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: srv.projectColor || 'var(--accent-color)' }}
                  />
                  <span className="text-[13px] text-zinc-100 truncate">{srv.projectName}</span>
                  <span className="text-xs text-zinc-500 truncate">
                    {srv.name}
                    {srv.port > 0 ? ` · :${srv.port}` : ''}
                  </span>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <span className="stat-value text-xs text-zinc-500 w-28 text-right">
                    {srv.cpu_usage ? srv.cpu_usage.toFixed(1) : '0.0'}% · {srv.ram_mb ? srv.ram_mb.toFixed(0) : '0'} Mo
                  </span>
                  <div className="flex items-center gap-1">
                    {srv.port > 0 && (
                      <button
                        onClick={() =>
                          onOpenBrowser
                            ? onOpenBrowser(srv.id, `http://localhost:${srv.port}`)
                            : handleOpenBrowser(`http://localhost:${srv.port}`)
                        }
                        className="w-7 h-7 rounded-md text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer flex items-center justify-center"
                        title="Ouvrir l'aperçu"
                        aria-label="Ouvrir l'aperçu"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => handleStopServer(srv.id, srv.name)}
                      className="w-7 h-7 rounded-md text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 transition-colors cursor-pointer flex items-center justify-center"
                      title="Arrêter"
                      aria-label="Arrêter"
                    >
                      <Square className="w-3 h-3 fill-current" />
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
