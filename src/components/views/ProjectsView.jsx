import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Play, Square, RotateCw, ExternalLink, Code2, Folder, FileText, Trash2, Plus, Terminal, Edit3, ChevronDown, ChevronRight, Sparkles, Activity, Layers, Globe, Share2, Clock } from 'lucide-react';
import { triggerToast } from '../ui/ToastContainer';

const serverStartTimestamps = {};

function ServerUptimeBadge({ serverId, isRunning }) {
  const [uptimeStr, setUptimeStr] = useState('0s');

  useEffect(() => {
    if (!isRunning) {
      delete serverStartTimestamps[serverId];
      setUptimeStr('0s');
      return;
    }

    if (!serverStartTimestamps[serverId]) {
      serverStartTimestamps[serverId] = Date.now();
    }

    const update = () => {
      const startTime = serverStartTimestamps[serverId];
      const diffSec = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
      if (diffSec < 60) {
        setUptimeStr(`${diffSec}s`);
      } else if (diffSec < 3600) {
        const m = Math.floor(diffSec / 60);
        const s = diffSec % 60;
        setUptimeStr(`${m}m ${s}s`);
      } else {
        const h = Math.floor(diffSec / 3600);
        const m = Math.floor((diffSec % 3600) / 60);
        setUptimeStr(`${h}h ${m}m`);
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [serverId, isRunning]);

  return (
    <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30 flex items-center gap-1.5 shadow-sm">
      <Clock className="w-3.5 h-3.5 text-purple-400" />
      <span>{uptimeStr}</span>
    </span>
  );
}

export default function ProjectsView({
  projects,
  saveProjects,
  onOpenTerminal,
  onOpenEnvModal,
  onAddProject,
  onEditProject,
  onEditServer,
  onAddServer,
}) {
  const [collapsedProjects, setCollapsedProjects] = useState(() => {
    try {
      const saved = localStorage.getItem('portly_collapsed_projects');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const toggleProjectCollapse = (projectId) => {
    setCollapsedProjects((prev) => {
      const updated = { ...prev, [projectId]: !prev[projectId] };
      try {
        localStorage.setItem('portly_collapsed_projects', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const handleToggleAll = () => {
    const allCollapsed = projects.every((p) => collapsedProjects[p.id]);
    const nextState = {};
    projects.forEach((p) => {
      nextState[p.id] = !allCollapsed;
    });
    setCollapsedProjects(nextState);
    try {
      localStorage.setItem('portly_collapsed_projects', JSON.stringify(nextState));
    } catch (e) {}
  };

  const handleStartServer = async (projectId, serverId, cwd, command, env) => {
    try {
      await invoke('start_server_cmd', {
        serverId,
        cwd,
        command,
        env: env || {},
      });
      triggerToast({
        title: '🚀 Serveur Démarré',
        message: `Command: ${command}`,
        type: 'success',
      });
    } catch (e) {
      console.error('Error starting server:', e);
      triggerToast({
        title: '⚠️ Échec du Démarrage',
        message: String(e),
        type: 'error',
      });
    }
  };

  const handleStopServer = async (projectId, serverId, pid) => {
    try {
      await invoke('stop_server_cmd', { serverId, pid: pid ? Number(pid) : null });
    } catch (e) {
      console.warn('Error stopping server:', e);
    }

    if (pid) {
      try {
        await invoke('kill_port_cmd', { pid: Number(pid) });
      } catch (e) {}
    }

    const updatedProjects = projects.map((p) => {
      if (p.id === projectId) {
        return {
          ...p,
          servers: (p.servers || []).map((s) => {
            if (s.id === serverId) {
              return { ...s, state: 'stopped', pid: null };
            }
            return s;
          }),
        };
      }
      return p;
    });

    saveProjects(updatedProjects);
    triggerToast({
      title: '⏹ Serveur Arrêté',
      message: `Le serveur a été arrêté avec succès.`,
      type: 'info',
    });
  };

  const handleShareTunnel = async (port, serverName) => {
    if (!port) return;
    triggerToast({
      title: `🌐 Génération du Tunnel...`,
      message: `Création de l'URL publique pour le port :${port}`,
      type: 'info',
      duration: 3000,
    });

    try {
      const publicUrl = await invoke('start_localtunnel_cmd', { port: Number(port) });
      if (publicUrl) {
        navigator.clipboard.writeText(publicUrl);
        triggerToast({
          title: `🌐 Tunnel Public Actif !`,
          message: `${publicUrl} (Copié dans le presse-papier !)`,
          type: 'success',
          duration: 7000,
        });
        invoke('open_browser', { url: publicUrl });
      }
    } catch (e) {
      console.error('Error generating tunnel:', e);
    }
  };

  const handleOpenVSCode = (path) => invoke('open_vscode', { path });
  const handleOpenExplorer = (path) => invoke('open_explorer', { path });
  const handleOpenBrowser = (url) => invoke('open_browser', { url });

  const handleDeleteProject = (projectId) => {
    const updated = projects.filter((p) => p.id !== projectId);
    saveProjects(updated);
  };

  const handleDeleteServer = (projectId, serverId) => {
    const updatedProjects = projects.map((prj) => {
      if (prj.id === projectId) {
        return {
          ...prj,
          servers: (prj.servers || []).filter((s) => s.id !== serverId),
        };
      }
      return prj;
    });
    saveProjects(updatedProjects);
  };

  const [copiedPath, setCopiedPath] = useState(null);

  const handleStartProjectServers = (project) => {
    (project.servers || []).forEach((srv) => {
      if (srv.state !== 'running') {
        handleStartServer(project.id, srv.id, project.root, srv.command, srv.env);
      }
    });
  };

  const handleStopProjectServers = async (project) => {
    const runningServers = (project.servers || []).filter((srv) => srv.state === 'running');
    if (runningServers.length === 0) return;

    const stoppedIds = new Set(runningServers.map((s) => s.id));

    for (const srv of runningServers) {
      try {
        await invoke('stop_server_cmd', { serverId: srv.id, pid: srv.pid ? Number(srv.pid) : null });
      } catch (e) {
        console.warn('Error stopping server:', e);
      }
      if (srv.pid) {
        try {
          await invoke('kill_port_cmd', { pid: Number(srv.pid) });
        } catch (e) {}
      }
    }

    const updatedProjects = projects.map((p) => {
      if (p.id === project.id) {
        return {
          ...p,
          servers: (p.servers || []).map((s) => {
            if (stoppedIds.has(s.id)) {
              return { ...s, state: 'stopped', pid: null };
            }
            return s;
          }),
        };
      }
      return p;
    });

    saveProjects(updatedProjects);
    triggerToast({
      title: '⏹ Serveurs Arrêtés',
      message: `Tous les serveurs du projet "${project.name}" ont été arrêtés.`,
      type: 'info',
    });
  };

  const handleCopyPath = (path) => {
    navigator.clipboard.writeText(path);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 2000);
  };

  return (
    <div className="space-y-6 animate-fadeIn select-none pb-8">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <span>Projets & Serveurs</span>
            <span className="text-xs font-mono font-normal px-2.5 py-0.5 rounded-full bg-white/[0.06] text-gray-300 border border-white/10">
              {projects.length} projet(s)
            </span>
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Supervisez vos micro-services, apps front & back en temps réel.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {projects.length > 0 && (
            <button
              onClick={handleToggleAll}
              className="px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 hover:text-white text-xs font-medium transition-all duration-200 cursor-pointer flex items-center gap-1.5 border border-white/[0.08] active:scale-95"
              title="Déplier ou replier tous les projets"
            >
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-300 ${
                  projects.every((p) => collapsedProjects[p.id]) ? '-rotate-90' : 'rotate-0'
                }`}
              />
              <span>{projects.every((p) => collapsedProjects[p.id]) ? 'Tout déplier' : 'Tout replier'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Projects List */}
      {projects.length === 0 ? (
        <div className="glass-panel p-12 rounded-2xl text-center space-y-4 border border-white/[0.08] shadow-2xl">
          <div className="w-14 h-14 rounded-2xl theme-accent-badge flex items-center justify-center mx-auto shadow-lg">
            <Folder className="w-7 h-7 theme-accent-text" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Aucun projet trouvé</h3>
            <p className="text-xs text-gray-400 max-w-sm mx-auto mt-1">
              Sélectionnez un dossier de votre ordinateur pour ajouter un projet et détecter son framework automatiquement.
            </p>
          </div>
          <button
            onClick={onAddProject}
            className="px-5 py-2.5 rounded-xl theme-accent-btn text-white text-xs font-bold transition-all cursor-pointer shadow-lg active:scale-95"
          >
            Sélectionner un Dossier
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {projects.map((project) => {
            const isCollapsed = !!collapsedProjects[project.id];
            const servers = project.servers || [];
            const activeServersCount = servers.filter((s) => s.state === 'running').length;
            const projColor = project.color || 'var(--accent-color)';

            return (
              <div
                key={project.id}
                className={`glass-panel p-5 rounded-2xl border border-white/[0.08] hover:border-purple-500/30 hover:shadow-2xl hover:shadow-purple-500/5 transition-all duration-300 ${
                  isCollapsed ? '' : 'space-y-4'
                }`}
              >
                {/* Project Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3.5">
                    {/* Accordion Collapse Trigger */}
                    <button
                      onClick={() => toggleProjectCollapse(project.id)}
                      className="p-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.1] text-gray-400 hover:text-white transition-all cursor-pointer group shrink-0"
                      title={isCollapsed ? 'Déplier les serveurs' : 'Replier le projet'}
                    >
                      <ChevronDown
                        className={`w-4 h-4 text-gray-300 transition-transform duration-300 ${
                          isCollapsed ? '-rotate-90 text-gray-500' : 'rotate-0 text-white'
                        }`}
                      />
                    </button>

                    {/* Color Dot with Aura Glow */}
                    <div
                      className="w-4 h-4 rounded-full shadow-lg cursor-pointer hover:scale-125 transition-transform duration-200 shrink-0"
                      style={{
                        backgroundColor: projColor,
                        boxShadow: `0 0 14px ${projColor}`,
                      }}
                      onClick={() => toggleProjectCollapse(project.id)}
                    />

                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h2
                          className="text-base font-bold text-white cursor-pointer hover:theme-accent-text transition-colors"
                          onClick={() => toggleProjectCollapse(project.id)}
                        >
                          {project.name}
                        </h2>

                        {project.framework && (
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full theme-accent-badge font-mono tracking-wide">
                            {project.framework}
                          </span>
                        )}

                        {project.branch && (
                          <span
                            className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-pink-500/15 text-pink-300 font-mono border border-pink-500/30 flex items-center gap-1 shadow-sm max-w-[150px] truncate"
                            title={`git branch: ${project.branch}`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-pink-400 shrink-0"></span>
                            <span className="truncate">git: {project.branch}</span>
                          </span>
                        )}

                        {/* Active Servers Count Badge */}
                        <span
                          className={`text-[10px] font-mono font-medium px-2.5 py-0.5 rounded-full border transition-all ${
                            activeServersCount > 0
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 font-bold shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                              : 'bg-white/[0.04] text-gray-400 border-white/[0.08]'
                          }`}
                        >
                          {servers.length} serveur{servers.length > 1 ? 's' : ''}
                          {activeServersCount > 0 && (
                            <span className="text-emerald-400 font-bold ml-1.5">
                              • {activeServersCount} en cours
                            </span>
                          )}
                        </span>
                      </div>

                      <p
                        onClick={() => handleCopyPath(project.root)}
                        className="text-[11px] text-gray-400 font-mono mt-1 cursor-pointer hover:text-purple-300 transition-colors flex items-center gap-1.5 group/path"
                        title="Cliquer pour copier le chemin du dossier"
                      >
                        <span className="truncate">{project.root}</span>
                        <span className="text-[10px] opacity-0 group-hover/path:opacity-100 text-purple-400 font-sans transition-opacity shrink-0 font-medium">
                          {copiedPath === project.root ? '✓ Copié !' : '📋 Copier'}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Project Quick Action Tools */}
                  <div className="flex items-center gap-2 shrink-0">
                    {servers.length > 1 && (
                      activeServersCount > 0 ? (
                        <button
                          onClick={() => handleStopProjectServers(project)}
                          className="px-3.5 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold text-xs flex items-center gap-1.5 border border-red-500/40 shadow-lg shadow-red-500/10 transition-all duration-200 cursor-pointer active:scale-95 group"
                          title="Arrêter tous les serveurs de ce projet"
                        >
                          <Square className="w-3.5 h-3.5 fill-red-400 text-red-400 group-hover:scale-110 transition-transform" />
                          <span>Arrêter Tout</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStartProjectServers(project)}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold text-xs flex items-center gap-1.5 border border-emerald-500/40 shadow-lg shadow-emerald-500/10 transition-all duration-200 cursor-pointer active:scale-95 group"
                          title="Lancer tous les serveurs de ce projet"
                        >
                          <Play className="w-3.5 h-3.5 fill-emerald-400 text-emerald-400 group-hover:translate-x-0.5 transition-transform" />
                          <span>Lancer Tout</span>
                        </button>
                      )
                    )}

                    <button
                      onClick={() => handleOpenVSCode(project.root)}
                      className="p-2 rounded-xl bg-white/[0.04] hover:bg-blue-500/20 text-gray-300 hover:text-blue-400 border border-white/[0.06] hover:border-blue-500/30 transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95"
                      title="Ouvrir dans VS Code"
                    >
                      <Code2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleOpenExplorer(project.root)}
                      className="p-2 rounded-xl bg-white/[0.04] hover:bg-amber-500/20 text-gray-300 hover:text-amber-400 border border-white/[0.06] hover:border-amber-500/30 transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95"
                      title="Ouvrir l'explorateur de fichiers"
                    >
                      <Folder className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => onOpenEnvModal(project.root)}
                      className="p-2 rounded-xl bg-white/[0.04] hover:bg-emerald-500/20 text-gray-300 hover:text-emerald-400 border border-white/[0.06] hover:border-emerald-500/30 transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95"
                      title="Éditer le fichier .env"
                    >
                      <FileText className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => onEditProject && onEditProject(project)}
                      className="p-2 rounded-xl bg-white/[0.04] hover:bg-purple-500/20 text-gray-300 hover:text-purple-300 border border-white/[0.06] hover:border-purple-500/30 transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95"
                      title="Modifier le nom et la couleur du projet"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDeleteProject(project.id)}
                      className="p-2 rounded-xl bg-white/[0.04] hover:bg-red-500/20 text-gray-400 hover:text-red-400 border border-white/[0.06] hover:border-red-500/30 transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95"
                      title="Supprimer le projet de Portly"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Accordion Content with Smooth Motion Transition */}
                <div
                  className={`grid transition-all duration-300 ease-in-out ${
                    isCollapsed
                      ? 'grid-rows-[0fr] opacity-0 pointer-events-none mt-0'
                      : 'grid-rows-[1fr] opacity-100 mt-3'
                  }`}
                >
                  <div className="overflow-hidden space-y-3">
                    {/* Smooth Animated Gradient Divider */}
                    <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent mb-2" />

                    {servers.map((srv) => {
                      const isRunning = srv.state === 'running';

                      return (
                        <div
                          key={srv.id}
                          className={`p-3.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all duration-200 border ${
                            isRunning
                              ? 'bg-emerald-500/[0.05] border-emerald-500/30 shadow-lg shadow-emerald-500/5'
                              : 'glass-card border-white/[0.06] hover:border-white/15'
                          }`}
                        >
                          <div className="flex items-center gap-3.5">
                            {/* Animated Dual Pulse Status Indicator */}
                            <div className="shrink-0 flex items-center justify-center">
                              {isRunning ? (
                                <span className="relative flex h-3 w-3">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 shadow-[0_0_10px_#10b981]"></span>
                                </span>
                              ) : (
                                <span className="w-3 h-3 rounded-full bg-gray-600/70 border border-gray-500/40"></span>
                              )}
                            </div>

                            <div>
                              <div className="flex items-center gap-2.5 flex-wrap">
                                <span className="text-sm font-bold text-white tracking-tight">{srv.name}</span>

                                <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold theme-accent-badge">
                                  :{srv.port}
                                </span>

                                {isRunning ? (
                                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono tracking-wide flex items-center gap-1.5 shadow-sm">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                    <span>EN COURS</span>
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/[0.04] text-gray-400 border border-white/[0.08] font-mono">
                                    ARRÊTÉ
                                  </span>
                                )}

                                {isRunning && (
                                  <ServerUptimeBadge serverId={srv.id} isRunning={isRunning} />
                                )}

                                {srv.pid && (
                                  <span
                                    className="text-xs font-mono text-gray-400 bg-white/[0.04] px-2.5 py-0.5 rounded-full border border-white/10"
                                    title={`PID ${srv.pid} | Guard RAM Max: ${srv.ramLimit || 500} MB`}
                                  >
                                    PID {srv.pid}
                                  </span>
                                )}
                              </div>

                              <p className="text-xs font-mono text-gray-400 mt-1 selection:bg-purple-500/30">
                                {srv.command}
                              </p>
                            </div>
                          </div>

                          {/* Server Action Controls */}
                          <div className="flex items-center gap-2 shrink-0">
                            {isRunning ? (
                              <button
                                onClick={() => handleStopServer(project.id, srv.id, srv.pid)}
                                className="px-3.5 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold text-xs flex items-center gap-1.5 border border-red-500/40 shadow-lg shadow-red-500/10 transition-all duration-200 cursor-pointer active:scale-95 group"
                              >
                                <Square className="w-3.5 h-3.5 fill-red-400 text-red-400 group-hover:scale-110 transition-transform" />
                                <span>Arrêter</span>
                              </button>
                            ) : (
                              <button
                                onClick={() =>
                                  handleStartServer(project.id, srv.id, project.root, srv.command, srv.env)
                                }
                                className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold text-xs flex items-center gap-1.5 border border-emerald-500/40 shadow-lg shadow-emerald-500/10 transition-all duration-200 cursor-pointer active:scale-95 group"
                              >
                                <Play className="w-3.5 h-3.5 fill-emerald-400 text-emerald-400 group-hover:translate-x-0.5 transition-transform" />
                                <span>Lancer</span>
                              </button>
                            )}

                            {srv.port > 0 && (
                              <>
                                <button
                                  onClick={() => handleOpenBrowser(`http://localhost:${srv.port}`)}
                                  className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.1] text-gray-300 hover:text-white border border-white/[0.08] transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95 group"
                                  title={`Ouvrir http://localhost:${srv.port}`}
                                >
                                  <ExternalLink className="w-3.5 h-3.5 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
                                </button>

                                <button
                                  onClick={() => handleShareTunnel(srv.port, srv.name)}
                                  className="p-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95 group"
                                  title="Partager un lien Tunnel Web/Mobile public"
                                >
                                  <Globe className="w-3.5 h-3.5 group-hover:rotate-45 transition-transform" />
                                </button>
                              </>
                            )}

                            <button
                              onClick={() => onEditServer && onEditServer({ projectId: project.id, project, server: srv })}
                              className="p-2 rounded-xl bg-white/[0.04] hover:bg-purple-500/20 text-gray-300 hover:text-purple-300 border border-white/[0.08] hover:border-purple-500/30 transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95"
                              title="Modifier la commande ou le port"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => onOpenTerminal(srv.id, srv.name)}
                              className="p-2 rounded-xl theme-accent-badge hover:bg-white/[0.1] transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95"
                              title="Consulter les logs en temps réel"
                            >
                              <Terminal className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleDeleteServer(project.id, srv.id)}
                              className="p-2 rounded-xl bg-white/[0.04] hover:bg-red-500/20 text-gray-400 hover:text-red-400 border border-white/[0.06] hover:border-red-500/30 transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95"
                              title="Supprimer ce serveur du projet"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {/* Interactive Dashed Add Server Button */}
                    <button
                      onClick={() => onAddServer && onAddServer(project)}
                      className="w-full py-3 px-4 rounded-2xl border-2 border-dashed border-white/10 hover:border-purple-500/40 bg-white/[0.01] hover:bg-purple-500/[0.07] text-gray-400 hover:text-purple-300 text-xs font-semibold flex items-center justify-center gap-2 transition-all duration-300 cursor-pointer group shadow-inner"
                    >
                      <Plus className="w-4 h-4 text-purple-400 group-hover:rotate-90 group-hover:scale-110 transition-all duration-300" />
                      <span>Ajouter un serveur à ce projet</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
