import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Play, Square, RotateCw, ExternalLink, Code2, Folder, FileText, Trash2, Plus, Terminal, Edit3, ChevronDown, ChevronRight, Sparkles, Activity, Layers } from 'lucide-react';

export default function ProjectsView({
  projects,
  saveProjects,
  onOpenTerminal,
  onOpenEnvModal,
  onAddProject,
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
    } catch (e) {
      console.error('Error starting server:', e);
    }
  };

  const handleStopServer = async (serverId) => {
    try {
      await invoke('stop_server_cmd', { serverId });
    } catch (e) {
      console.error('Error stopping server:', e);
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

  const handleStopProjectServers = (project) => {
    (project.servers || []).forEach((srv) => {
      if (srv.state === 'running') {
        handleStopServer(srv.id);
      }
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
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-white tracking-tight">{srv.name}</span>

                                <span className="text-[11px] font-mono font-semibold text-purple-400">
                                  :{srv.port}
                                </span>

                                {/* Status Pill Badge */}
                                {isRunning ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono tracking-wide flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                    EN COURS
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/[0.04] text-gray-400 border border-white/[0.08] font-mono">
                                    ARRÊTÉ
                                  </span>
                                )}

                                {srv.pid && (
                                  <span className="text-[10px] font-mono theme-accent-badge px-2 py-0.5 rounded-full font-bold">
                                    PID: {srv.pid}
                                  </span>
                                )}
                              </div>

                              <p className="text-[11px] font-mono text-gray-400 mt-1 selection:bg-purple-500/30">
                                {srv.command}
                              </p>
                            </div>
                          </div>

                          {/* Server Action Controls */}
                          <div className="flex items-center gap-2 shrink-0">
                            {isRunning ? (
                              <button
                                onClick={() => handleStopServer(srv.id)}
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
                              <button
                                onClick={() => handleOpenBrowser(`http://localhost:${srv.port}`)}
                                className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.1] text-gray-300 hover:text-white border border-white/[0.08] transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95 group"
                                title={`Ouvrir http://localhost:${srv.port}`}
                              >
                                <ExternalLink className="w-3.5 h-3.5 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
                              </button>
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
