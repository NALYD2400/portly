import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Play,
  Square,
  ExternalLink,
  Code2,
  Folder,
  FileText,
  Trash2,
  Plus,
  Terminal,
  Edit3,
  ChevronDown,
  Globe,
  Clock,
  Search,
  Monitor,
  MoreHorizontal,
  GitBranch,
} from 'lucide-react';
import { triggerToast } from '../../services/toastBus';
import ConfirmDialog from '../ui/ConfirmDialog';
import IframePreviewModal from '../modals/IframePreviewModal';
import { markManualStop } from '../../hooks/useTauriIPC';

const serverStartTimestamps = {};

function ServerUptimeBadge({ serverId, isRunning }) {
  const [uptimeStr, setUptimeStr] = useState('0s');

  useEffect(() => {
    if (!isRunning) {
      delete serverStartTimestamps[serverId];
      setUptimeStr('0s');
      return undefined;
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
    <span className="text-[11px] font-mono text-emerald-400 font-medium flex items-center gap-1">
      <Clock className="w-3 h-3 text-emerald-400" />
      <span>{uptimeStr}</span>
    </span>
  );
}

export default function ProjectsView({
  projects,
  saveProjects,
  onOpenTerminal,
  onOpenBrowser,
  onOpenEnvModal,
  onAddProject,
  onEditProject,
  onEditServer,
  onAddServer,
}) {
  const [collapsedProjects, setCollapsedProjects] = useState(() => {
    try {
      const saved = localStorage.getItem('sprint_collapsed_projects') || localStorage.getItem('portly_collapsed_projects');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [search, setSearch] = useState('');
  const [copiedPath, setCopiedPath] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [iframeTarget, setIframeTarget] = useState(null);
  const [openMenu, setOpenMenu] = useState(null); // { type: 'project'|'server', id: string } | null

  // Fermer le menu au clic a l'exterieur ou via la touche Echap
  useEffect(() => {
    if (!openMenu) return undefined;

    const handlePointerDown = (e) => {
      if (!e.target.closest('[data-dropdown-container]')) {
        setOpenMenu(null);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setOpenMenu(null);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openMenu]);

  const toggleProjectCollapse = (projectId) => {
    setCollapsedProjects((prev) => {
      const updated = { ...prev, [projectId]: !prev[projectId] };
      try {
        localStorage.setItem('sprint_collapsed_projects', JSON.stringify(updated));
      } catch {}
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
      localStorage.setItem('sprint_collapsed_projects', JSON.stringify(nextState));
    } catch {}
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
      triggerToast({
        title: '⚠️ Échec du Démarrage',
        message: String(e),
        type: 'error',
      });
    }
  };

  const handleStopServer = async (projectId, serverId) => {
    markManualStop(serverId);
    try {
      await invoke('stop_server_cmd', { serverId });
      triggerToast({
        title: '⏹ Serveur Arrêté',
        message: 'Le serveur a été arrêté avec succès.',
        type: 'info',
      });
    } catch (e) {
      if (String(e).includes("n'est pas en cours")) {
        triggerToast({
          title: '⏹ Serveur déjà arrêté',
          message: 'Le processus ne tournait plus.',
          type: 'info',
        });
      } else {
        triggerToast({
          title: '⚠️ Échec de l\'Arrêt',
          message: String(e),
          type: 'error',
        });
      }
    }
  };

  const handleShareTunnel = async (port) => {
    if (!port) return;
    triggerToast({
      title: '🌐 Génération du Tunnel...',
      message: `Création de l'URL publique pour le port :${port}`,
      type: 'info',
      duration: 3000,
    });

    try {
      const publicUrl = await invoke('start_localtunnel_cmd', { port: Number(port) });
      if (publicUrl) {
        navigator.clipboard.writeText(publicUrl);
        triggerToast({
          title: '🌐 Tunnel Public Actif !',
          message: `${publicUrl} (Copié dans le presse-papier !)`,
          type: 'success',
          duration: 7000,
        });
        invoke('open_browser', { url: publicUrl });
      }
    } catch (e) {
      triggerToast({
        title: '⚠️ Échec du Tunnel',
        message: String(e),
        type: 'error',
        duration: 7000,
      });
    }
  };

  const handleOpenVSCode = (path) =>
    invoke('open_vscode', { path }).catch((e) =>
      triggerToast({ title: '⚠️ VS Code', message: String(e), type: 'error' })
    );
  const handleOpenExplorer = (path) =>
    invoke('open_explorer', { path }).catch((e) =>
      triggerToast({ title: '⚠️ Explorateur', message: String(e), type: 'error' })
    );
  const handleOpenBrowser = (url) =>
    invoke('open_browser', { url }).catch((e) =>
      triggerToast({ title: '⚠️ Navigateur', message: String(e), type: 'error' })
    );

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

    for (const srv of runningServers) {
      markManualStop(srv.id);
      try {
        await invoke('stop_server_cmd', { serverId: srv.id });
      } catch (err) {
        console.warn('Error stopping server:', err);
      }
    }

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

  const confirmDeleteTarget = confirmDelete || {};
  const confirmDeleteMessage =
    confirmDeleteTarget.type === 'server'
      ? `Supprimer le serveur « ${confirmDeleteTarget.name} » de « ${confirmDeleteTarget.projectName} » ? Sa configuration (commande, port, .env du serveur) sera définitivement perdue.`
      : `Supprimer le projet « ${confirmDeleteTarget.name} » et ses ${confirmDeleteTarget.serverCount ?? 0} serveur(s) configurés ? Les fichiers du projet ne seront PAS touchés, mais la configuration Sprint sera définitivement perdue.`;

  const executeConfirmedDelete = () => {
    if (!confirmDelete) return;

    if (confirmDelete.type === 'project') {
      saveProjects(projects.filter((p) => p.id !== confirmDelete.projectId));
      triggerToast({
        title: '🗑 Projet Supprimé',
        message: `« ${confirmDelete.name} » a été retiré de Sprint.`,
        type: 'warning',
      });
    } else if (confirmDelete.type === 'server') {
      const updatedProjects = projects.map((prj) => {
        if (prj.id === confirmDelete.projectId) {
          return {
            ...prj,
            servers: (prj.servers || []).filter((s) => s.id !== confirmDelete.serverId),
          };
        }
        return prj;
      });
      saveProjects(updatedProjects);
      triggerToast({
        title: '🗑 Serveur Supprimé',
        message: `« ${confirmDelete.name} » a été retiré du projet.`,
        type: 'warning',
      });
    }

    setConfirmDelete(null);
  };

  const q = search.trim().toLowerCase();
  const filteredProjects = q
    ? projects.filter((p) => {
        const inProject =
          p.name.toLowerCase().includes(q) ||
          (p.root || '').toLowerCase().includes(q) ||
          (p.framework || '').toLowerCase().includes(q);
        const inServers = (p.servers || []).some(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            (s.command || '').toLowerCase().includes(q) ||
            String(s.port || '').includes(q)
        );
        return inProject || inServers;
      })
    : projects;

  const totalRunningServers = projects.reduce(
    (acc, p) => acc + (p.servers || []).filter((s) => s.state === 'running').length,
    0
  );

  return (
    <div className="space-y-4 animate-fadeIn select-none pb-12 max-w-6xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-50 tracking-tight flex items-center gap-2.5">
            <span>Projets & Serveurs</span>
            <span className="text-[11px] font-mono font-normal px-1.5 py-px rounded-md bg-white/[0.06] text-zinc-400">
              {projects.length} projet{projects.length > 1 ? 's' : ''}
            </span>
            {totalRunningServers > 0 && (
              <span className="text-[11px] font-mono font-medium px-1.5 py-px rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 live-dot"></span>
                <span>{totalRunningServers} actif{totalRunningServers > 1 ? 's' : ''}</span>
              </span>
            )}
          </h1>
          <p className="text-[13px] text-zinc-500 mt-1">
            Supervisez vos applications et processus locaux en temps réel.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {projects.length > 0 && (
            <>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filtrer projets, ports..."
                  className="pl-9 pr-3 py-2 rounded-lg bg-white/[0.04] border border-[var(--line)] text-xs text-white placeholder-zinc-600 focus:outline-none theme-accent-border w-44 sm:w-52 transition-all"
                />
              </div>

              <button
                onClick={handleToggleAll}
                className="px-3 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white text-xs font-medium transition-all duration-200 cursor-pointer flex items-center gap-1.5 border border-[var(--line)] shrink-0"
                title="Déplier ou replier tous les projets"
              >
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-300 ${
                    projects.every((p) => collapsedProjects[p.id]) ? '-rotate-90' : 'rotate-0'
                  }`}
                />
                <span>{projects.every((p) => collapsedProjects[p.id]) ? 'Tout déplier' : 'Tout replier'}</span>
              </button>
            </>
          )}

          <button
            onClick={onAddProject}
            className="px-3.5 py-2 rounded-lg theme-accent-btn text-white text-xs font-semibold transition-all duration-200 cursor-pointer flex items-center gap-1.5 shrink-0"
            title="Ajouter un nouveau projet dans Sprint"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nouveau Projet</span>
          </button>
        </div>
      </div>

      {/* Projects List */}
      {projects.length === 0 ? (
        <div className="glass-panel p-12 rounded-xl text-center space-y-4 border border-[var(--line)]">
          <div className="w-14 h-14 rounded-xl theme-accent-badge flex items-center justify-center mx-auto">
            <Folder className="w-7 h-7 theme-accent-text" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Aucun projet trouvé</h3>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-1">
              Sélectionnez un dossier de votre ordinateur pour ajouter un projet et détecter ses commandes automatiquement.
            </p>
          </div>
          <button
            onClick={onAddProject}
            className="px-5 py-2.5 rounded-lg theme-accent-btn text-white text-xs font-semibold transition-all cursor-pointer "
          >
            Sélectionner un Dossier
          </button>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="glass-panel p-10 rounded-xl text-center border border-[var(--line)]">
          <Search className="w-8 h-8 text-zinc-500 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-white">Aucun projet ne correspond</h3>
          <p className="text-xs text-zinc-400 mt-1">
            Aucun résultat pour « {search} ». Essayez un autre nom, chemin ou port.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredProjects.map((project) => {
            const isCollapsed = !!collapsedProjects[project.id];
            const servers = project.servers || [];
            const activeServersCount = servers.filter((s) => s.state === 'running').length;
           const projColor = project.color || 'var(--accent-color)';
           const isProjectMenuOpen = openMenu?.type === 'project' && openMenu.id === project.id;
            const hasActiveMenu = isProjectMenuOpen || (openMenu?.type === 'server' && servers.some((s) => s.id === openMenu?.id));

           return (
             <div
               key={project.id}
               className={`rounded-xl border transition-all duration-200 bg-[var(--surface-1)] ${
                  hasActiveMenu
                   ? 'border-[var(--line-strong)] relative z-30'
                   : 'border-[var(--line)] hover:border-white/[0.14]'
               } ${isCollapsed ? 'p-3.5' : 'p-4 space-y-3'}`}
             >
                {/* Project Header */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Accordion Collapse Trigger */}
                    <button
                      onClick={() => toggleProjectCollapse(project.id)}
                      className="p-1 rounded-lg hover:bg-white/[0.06] text-zinc-400 hover:text-white transition-all cursor-pointer shrink-0"
                      title={isCollapsed ? 'Déplier les serveurs' : 'Replier le projet'}
                      aria-label={isCollapsed ? 'Déplier les serveurs' : 'Replier le projet'}
                    >
                      <ChevronDown
                        className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${
                          isCollapsed ? '-rotate-90 text-zinc-500' : 'rotate-0 text-white'
                        }`}
                      />
                    </button>

                    {/* Color Dot */}
                    <div
                      className="w-3 h-3 rounded-full cursor-pointer hover:scale-125 transition-transform duration-200 shrink-0"
                      style={{
                        backgroundColor: projColor,
                        
                      }}
                      onClick={() => toggleProjectCollapse(project.id)}
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2
                          className="text-sm font-semibold text-white cursor-pointer hover:text-white/90 transition-colors truncate"
                          onClick={() => toggleProjectCollapse(project.id)}
                        >
                          {project.name}
                        </h2>

                        {project.framework && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.04] text-zinc-400 border border-[var(--line)]">
                            {project.framework}
                          </span>
                        )}

                        {project.branch && (
                          <span
                            className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.03] text-zinc-400 border border-[var(--line)] flex items-center gap-1 max-w-[140px] truncate"
                            title={`git branch: ${project.branch}`}
                          >
                            <GitBranch className="w-2.5 h-2.5 text-zinc-400 shrink-0" />
                            <span className="truncate">git: {project.branch}</span>
                          </span>
                        )}

                        {/* Active Servers Count Badge */}
                        {activeServersCount > 0 ? (
                          <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 live-dot"></span>
                            <span>{activeServersCount}/{servers.length} actif{activeServersCount > 1 ? 's' : ''}</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-zinc-500 px-1.5 py-0.5 rounded bg-white/[0.02]">
                            {servers.length} serveur{servers.length > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>

                      <p
                        onClick={() => handleCopyPath(project.root)}
                        className="text-[11px] text-zinc-500 font-mono mt-0.5 cursor-pointer hover:text-zinc-300 transition-colors flex items-center gap-1.5 group/path truncate max-w-lg"
                        title="Cliquer pour copier le chemin du dossier"
                      >
                        <span className="truncate">{project.root}</span>
                        <span className="text-[10px] opacity-0 group-hover/path:opacity-100 theme-accent-text font-sans transition-opacity shrink-0">
                          {copiedPath === project.root ? '✓ Copié !' : '📋 Copier'}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Project Quick Action Tools */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {servers.length > 1 && (
                      activeServersCount > 0 ? (
                        <button
                          onClick={() => handleStopProjectServers(project)}
                          className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 font-medium text-xs flex items-center gap-1.5 border border-rose-500/20 transition-all cursor-pointer "
                          title="Arrêter tous les serveurs"
                        >
                          <Square className="w-3 h-3 fill-rose-400 text-rose-400" />
                          <span>Tout arrêter</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStartProjectServers(project)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 font-medium text-xs flex items-center gap-1.5 border border-emerald-500/20 transition-all cursor-pointer "
                          title="Lancer tous les serveurs"
                        >
                          <Play className="w-3 h-3 fill-emerald-400 text-emerald-400" />
                          <span>Tout lancer</span>
                        </button>
                      )
                    )}

                    {/* More Actions Dropdown for Project */}
                    <div className="relative" data-dropdown-container>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenu((prev) =>
                            prev?.type === 'project' && prev?.id === project.id
                              ? null
                              : { type: 'project', id: project.id }
                          );
                        }}
                        className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                          isProjectMenuOpen
                            ? 'bg-white/[0.12] text-white border-[var(--line-strong)]'
                            : 'bg-white/[0.02] hover:bg-white/[0.06] text-zinc-400 hover:text-white border-[var(--line)]'
                        }`}
                        title="Options du projet"
                        aria-label="Options du projet"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>

                      {isProjectMenuOpen && (
                        <div
                          className="absolute right-0 top-full mt-1.5 w-56 rounded-lg p-1.5 z-50 text-xs font-sans animate-scaleUp select-none bg-[var(--surface-2)] border border-[var(--line-strong)]"
                        >
                          <button
                            onClick={() => {
                              setOpenMenu(null);
                              handleOpenVSCode(project.root);
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-zinc-200 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer text-left"
                          >
                            <Code2 className="w-3.5 h-3.5 text-blue-400" />
                            <span>Ouvrir dans VS Code</span>
                          </button>

                          <button
                            onClick={() => {
                              setOpenMenu(null);
                              handleOpenExplorer(project.root);
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-zinc-200 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer text-left"
                          >
                            <Folder className="w-3.5 h-3.5 text-amber-400" />
                            <span>Ouvrir le dossier</span>
                          </button>

                          <button
                            onClick={() => {
                              setOpenMenu(null);
                              onOpenEnvModal(project.root);
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-zinc-200 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer text-left"
                          >
                            <FileText className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Variables .env</span>
                          </button>

                          {(project.url || (servers[0] && (servers[0].url || servers[0].port > 0))) && (
                            <button
                              onClick={() => {
                                setOpenMenu(null);
                                const targetUrl =
                                  project.url || servers[0]?.url || `http://localhost:${servers[0]?.port}`;
                                if (onOpenBrowser) {
                                  onOpenBrowser(servers[0]?.id, targetUrl);
                                } else {
                                  setIframeTarget({ url: targetUrl, title: project.name });
                                }
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-zinc-200 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer text-left"
                            >
                              <Monitor className="w-3.5 h-3.5 text-purple-400" />
                              <span>Aperçu Web & Devices</span>
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setOpenMenu(null);
                              onEditProject && onEditProject(project);
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-zinc-200 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer text-left"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Modifier le projet</span>
                          </button>

                          <div className="my-1 border-t border-[var(--line)]" />

                          <button
                            onClick={() => {
                              setOpenMenu(null);
                              setConfirmDelete({
                                type: 'project',
                                projectId: project.id,
                                name: project.name,
                                serverCount: servers.length,
                              });
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer text-left"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                            <span>Supprimer le projet</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Accordion Content */}
                {!isCollapsed && (
                  <div className="space-y-1.5 pt-2 border-t border-[var(--line)]">
                    {servers.map((srv) => {
                      const isRunning = srv.state === 'running';
                      const isServerMenuOpen = openMenu?.type === 'server' && openMenu.id === srv.id;

                      return (
                        <div
                          key={srv.id}
                          className={`px-3.5 py-2.5 rounded-lg flex items-center justify-between gap-3 transition-all duration-150 border ${
                            isServerMenuOpen
                              ? 'bg-white/[0.05] border-[var(--line-strong)] relative z-40'
                              : isRunning
                              ? 'bg-emerald-500/[0.03] border-emerald-500/20 hover:border-emerald-500/30'
                              : 'bg-white/[0.015] border-[var(--line)] hover:bg-white/[0.03] hover:border-[var(--line)]'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {/* Animated Dual Pulse Status Indicator */}
                            <div className="shrink-0 flex items-center justify-center">
                              {isRunning ? (
                                <span className="relative flex h-2.5 w-2.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                                </span>
                              ) : (
                                <span className="w-2.5 h-2.5 rounded-full bg-zinc-600/60"></span>
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-semibold text-white tracking-tight truncate">
                                  {srv.name}
                                </span>

                                {srv.port > 0 && (
                                  <span className="px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold theme-accent-badge">
                                    :{srv.port}
                                  </span>
                                )}

                                {isRunning ? (
                                  <ServerUptimeBadge serverId={srv.id} isRunning={isRunning} />
                                ) : (
                                  <span className="text-[10px] font-mono text-zinc-500">
                                    Arrêté
                                  </span>
                                )}

                                {srv.pid && (
                                  <span className="text-[10px] font-mono text-zinc-500">PID {srv.pid}</span>
                                )}
                              </div>

                              <p className="text-[11px] font-mono text-zinc-400 truncate mt-0.5 max-w-lg">
                                {srv.command}
                              </p>
                            </div>
                          </div>

                          {/* Server Action Controls */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {isRunning ? (
                              <button
                                onClick={() => handleStopServer(project.id, srv.id)}
                                className="px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 font-semibold text-xs flex items-center gap-1.5 border border-rose-500/30 transition-all cursor-pointer "
                                title="Arrêter ce serveur"
                              >
                                <Square className="w-3 h-3 fill-rose-400 text-rose-400" />
                                <span>Arrêter</span>
                              </button>
                            ) : (
                              <button
                                onClick={() =>
                                  handleStartServer(project.id, srv.id, project.root, srv.command, srv.env)
                                }
                                className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-semibold text-xs flex items-center gap-1.5 border border-emerald-500/40 transition-all cursor-pointer "
                                title="Démarrer ce serveur"
                              >
                                <Play className="w-3 h-3 fill-emerald-400 text-emerald-400" />
                                <span>Lancer</span>
                              </button>
                            )}

                            {/* Open in Browser (if running and has port) */}
                            {srv.port > 0 && isRunning && (
                              <button
                                onClick={() => handleOpenBrowser(`http://localhost:${srv.port}`)}
                                className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white border border-[var(--line)] transition-all cursor-pointer "
                                title={`Ouvrir http://localhost:${srv.port}`}
                                aria-label="Ouvrir dans le navigateur"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Open Terminal / Logs */}
                            <button
                              onClick={() => onOpenTerminal(srv.id, srv.name)}
                              className="p-1.5 rounded-lg bg-white/[0.04] hover-accent-bg text-zinc-300 theme-accent-text border border-[var(--line)] hover-accent-border transition-all cursor-pointer "
                              title="Voir les logs en direct"
                              aria-label="Logs du terminal"
                            >
                              <Terminal className="w-3.5 h-3.5" />
                            </button>

                            {/* Server More Actions Dropdown */}
                            <div className="relative" data-dropdown-container>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenu((prev) =>
                                    prev?.type === 'server' && prev?.id === srv.id
                                      ? null
                                      : { type: 'server', id: srv.id }
                                  );
                                }}
                                className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                  isServerMenuOpen
                                    ? 'bg-white/[0.1] text-white border-[var(--line-strong)]'
                                    : 'bg-white/[0.03] hover:bg-white/[0.08] text-zinc-400 hover:text-white border-[var(--line)]'
                                }`}
                                title="Options du serveur"
                                aria-label="Options du serveur"
                              >
                                <MoreHorizontal className="w-3.5 h-3.5" />
                              </button>

                              {isServerMenuOpen && (
                                <div
                                  className="absolute right-0 top-full mt-1.5 w-52 rounded-lg p-1.5 z-50 text-xs font-sans animate-scaleUp select-none bg-[var(--surface-2)] border border-[var(--line-strong)]"
                                >
                                  {(srv.url || srv.port > 0) && (
                                    <button
                                      onClick={() => {
                                        setOpenMenu(null);
                                        const targetUrl = srv.url || `http://localhost:${srv.port}`;
                                        if (onOpenBrowser) {
                                          onOpenBrowser(srv.id, targetUrl);
                                        } else {
                                          setIframeTarget({
                                            url: targetUrl,
                                            title: `${project.name} - ${srv.name}`,
                                          });
                                        }
                                      }}
                                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-zinc-200 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer text-left"
                                    >
                                      <Monitor className="w-3.5 h-3.5 text-purple-400" />
                                      <span>Aperçu Web & Devices</span>
                                    </button>
                                  )}

                                  {srv.port > 0 && (
                                    <button
                                      onClick={() => {
                                        setOpenMenu(null);
                                        handleShareTunnel(srv.port, srv.name);
                                      }}
                                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-zinc-200 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer text-left"
                                    >
                                      <Globe className="w-3.5 h-3.5 text-cyan-400" />
                                      <span>Créer un tunnel public</span>
                                    </button>
                                  )}

                                  <button
                                    onClick={() => {
                                      setOpenMenu(null);
                                      onEditServer &&
                                        onEditServer({
                                          projectId: project.id,
                                          project,
                                          server: srv,
                                        });
                                    }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-zinc-200 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer text-left"
                                  >
                                    <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
                                    <span>Modifier le serveur</span>
                                  </button>

                                  <div className="my-1 border-t border-[var(--line)]" />

                                  <button
                                    onClick={() => {
                                      setOpenMenu(null);
                                      setConfirmDelete({
                                        type: 'server',
                                        projectId: project.id,
                                        serverId: srv.id,
                                        name: srv.name,
                                        projectName: project.name,
                                      });
                                    }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer text-left"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                                    <span>Supprimer le serveur</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Discreet Add Server Button */}
                   <button
                     onClick={() => onAddServer && onAddServer(project)}
                     className="w-full py-2 px-3 rounded-lg border border-dashed border-[var(--line)] hover:border-[var(--line-strong)] bg-white/[0.01] hover:bg-white/[0.03] text-zinc-400 hover:text-white text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer"
                   >
                     <Plus className="w-3.5 h-3.5" />
                     <span>Ajouter un serveur</span>
                   </button>
                 </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title={confirmDeleteTarget.type === 'server' ? 'Supprimer ce serveur ?' : 'Supprimer ce projet ?'}
        message={confirmDeleteMessage}
        confirmLabel="Supprimer définitivement"
        danger
        onConfirm={executeConfirmedDelete}
        onCancel={() => setConfirmDelete(null)}
      />

      <IframePreviewModal
        isOpen={!!iframeTarget}
        onClose={() => setIframeTarget(null)}
        url={iframeTarget?.url}
        title={iframeTarget?.title}
      />
    </div>
  );
}
