import React, { useState, useEffect, useMemo, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useServerLogs } from '../../hooks/useTauriIPC';
import { Terminal, Trash2, Copy, Search, ArrowDown, Columns, Play, Filter, ArrowRight, Loader2 } from 'lucide-react';

// Nombre max de lignes rendues dans le DOM (fenêtre glissante)
const MAX_RENDERED_LINES = 500;

const LogLine = React.memo(function LogLine({ entry, lineNumber, showRaw }) {
  const { isError, isSuccess, isInfo } = entry;
  const text = showRaw ? entry.raw : entry.clean;
  return (
    <div
      className={`flex items-start px-2 py-0.5 rounded leading-relaxed break-all ${
        isError
          ? 'bg-red-500/10 text-red-300 border-l-2 border-red-500'
          : isSuccess
          ? 'bg-emerald-500/10 text-emerald-300 border-l-2 border-emerald-500'
          : isInfo
          ? 'theme-accent-text'
          : 'text-gray-300 hover:bg-white/[0.02]'
      }`}
    >
      <span className="text-gray-500 select-none mr-2.5 text-[10px] min-w-[2.2rem] text-right">
        {lineNumber}
      </span>
      <span className="flex-1">{text}</span>
    </div>
  );
});

// Single Terminal Panel Component
function TerminalPanel({ server, titlePrefix = 'Console' }) {
  const { logs, clearLogs } = useServerLogs(server?.id);
  const [filter, setFilter] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [expandedHistory, setExpandedHistory] = useState(false);
  const scrollRef = useRef(null);

  // Réglage utilisateur : nettoyage ANSI des logs
  const showRawAnsi = localStorage.getItem('portly_cfg_cleanansi') === 'false';

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const filteredLogs = useMemo(() => {
    if (!filter) return logs;
    const q = filter.toLowerCase();
    return logs.filter((entry) => entry.clean.toLowerCase().includes(q));
  }, [logs, filter]);

  const hiddenByWindow = expandedHistory ? 0 : Math.max(0, filteredLogs.length - MAX_RENDERED_LINES);
  const visibleLogs = expandedHistory ? filteredLogs : filteredLogs.slice(-MAX_RENDERED_LINES);

  const handleCopyLogs = () => {
    const cleanAll = logs.map((entry) => entry.clean).join('\n');
    navigator.clipboard.writeText(cleanAll);
  };

  return (
    <div className="flex-1 flex flex-col h-full glass-panel rounded-2xl p-4 border border-white/[0.08] bg-black/70 shadow-inner overflow-hidden select-none">
      {/* Panel Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] mb-3">
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              server?.state === 'running' ? 'bg-green-500 shadow-lg shadow-green-500/50 animate-pulse' : 'bg-gray-600'
            }`}
          />
          <div>
            <span className="text-[10px] font-mono uppercase font-bold mr-1.5 px-1.5 py-0.5 rounded theme-accent-badge">
              {titlePrefix}
            </span>
            <span className="text-xs font-bold text-white">{server?.name || 'Aucun serveur'}</span>
            {server && <span className="text-[10px] font-mono text-gray-400 ml-2">:{server.port}</span>}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="relative">
            <Search className="w-3 h-3 text-gray-400 absolute left-2 top-2" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filtrer..."
              className="pl-7 pr-2 py-1 rounded-lg bg-white/[0.04] border border-white/[0.1] text-[11px] text-white placeholder-gray-500 focus:outline-none theme-accent-border font-mono w-32"
            />
          </div>

          <button
            onClick={() => setAutoScroll(!autoScroll)}
            aria-pressed={autoScroll}
            className={`p-1.5 rounded-lg text-xs flex items-center transition-colors cursor-pointer ${
              autoScroll ? 'theme-accent-active' : 'bg-white/[0.04] text-gray-400'
            }`}
            title="Défilement automatique"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleCopyLogs}
            className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 transition-colors cursor-pointer"
            title="Copier les logs"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={clearLogs}
            className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors cursor-pointer"
            title="Effacer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Log Screen */}
      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
          if (!atBottom && autoScroll) setAutoScroll(false);
        }}
        className="flex-1 font-mono text-xs overflow-y-auto space-y-0.5 select-text"
      >
        {!server ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-gray-500 italic select-none">
            <span className="text-xs not-italic text-gray-400">
              Aucun autre serveur disponible pour la vue divisée.
            </span>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-gray-500 italic select-none">
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs not-italic">
              {filter ? (
                <>
                  <Search className="w-3 h-3 text-gray-400" />
                  <span className="text-gray-300 font-mono">Aucune ligne ne correspond au filtre « {filter} »</span>
                </>
              ) : (
                <>
                  {server?.state === 'running' ? (
                    <Loader2 className="w-3 h-3 text-green-500 animate-spin" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-gray-500" />
                  )}
                  <span className="text-gray-300 font-mono">
                    {server?.state === 'running'
                      ? `Écoute active du flux (${server?.command || 'cmd'})...`
                      : 'Serveur arrêté. Cliquez sur "Lancer" pour démarrer.'}
                  </span>
                </>
              )}
            </div>
          </div>
        ) : (
          <>
            {hiddenByWindow > 0 && (
              <button
                onClick={() => setExpandedHistory(true)}
                className="w-full text-center text-[10px] font-mono text-gray-500 hover:text-gray-300 py-1 border-b border-white/[0.05] cursor-pointer sticky top-0 bg-black/80 z-10"
              >
                ▲ {hiddenByWindow} lignes plus anciennes masquées — cliquer pour tout afficher
              </button>
            )}
            {visibleLogs.map((entry, i) => (
              <LogLine
                key={entry.id}
                entry={entry}
                lineNumber={hiddenByWindow + i + 1}
                showRaw={showRawAnsi}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

export default function TerminalView({ projects = [], initialServerId, onSelectTab }) {
  // Réglage utilisateur : n'afficher que les serveurs actifs par défaut
  const [showAllServers, setShowAllServers] = useState(
    () => localStorage.getItem('portly_cfg_hidestopped') === 'false'
  );

  // Collect all servers from projects
  const allServers = useMemo(() => {
    const list = [];
    projects.forEach((p) => {
      (p.servers || []).forEach((s) => {
        list.push({ ...s, projectName: p.name });
      });
    });
    return list;
  }, [projects]);

  const runningServers = useMemo(() => allServers.filter((s) => s.state === 'running'), [allServers]);
  const displayServers = showAllServers
    ? allServers
    : runningServers.length > 0
    ? runningServers
    : allServers;

  const [activeServerId, setActiveServerId] = useState(
    initialServerId || (displayServers[0] ? displayServers[0].id : null)
  );
  const [splitServerId, setSplitServerId] = useState(null);
  const [isSplitMode, setIsSplitMode] = useState(false);

  useEffect(() => {
    if (initialServerId) {
      setActiveServerId(initialServerId);
    }
  }, [initialServerId]);

  // Primary Server
  const primaryServer = displayServers.find((s) => s.id === activeServerId) || displayServers[0];

  // Secondary Server: strictly different from primaryServer
  let secondaryServer = displayServers.find((s) => s.id === splitServerId && s.id !== primaryServer?.id);
  if (!secondaryServer) {
    secondaryServer = displayServers.find((s) => s.id !== primaryServer?.id) || null;
  }

  const toggleSplitMode = () => {
    const nextMode = !isSplitMode;
    setIsSplitMode(nextMode);
    if (nextMode && (!splitServerId || splitServerId === primaryServer?.id)) {
      const distinct = displayServers.find((s) => s.id !== primaryServer?.id);
      if (distinct) setSplitServerId(distinct.id);
    }
  };

  const handleStartServer = async (server, project) => {
    try {
      await invoke('start_server_cmd', {
        serverId: server.id,
        cwd: project.root,
        command: server.command,
        env: server.env || {},
      });
    } catch (e) {
      console.warn('Failed to start server from terminal:', e);
    }
  };

  // If 0 servers are running and user hasn't forced "Show All", display clean empty state
  if (runningServers.length === 0 && !showAllServers) {
    const stoppedServers = allServers;
    return (
      <div className="space-y-4 animate-fadeIn h-[calc(100vh-5.5rem)] flex flex-col items-center justify-center select-none text-center">
        <div className="glass-panel p-8 rounded-3xl max-w-md border border-white/[0.08] space-y-4 bg-black/60 shadow-2xl">
          <div className="w-12 h-12 rounded-2xl theme-accent-badge flex items-center justify-center mx-auto">
            <Terminal className="w-6 h-6 theme-accent-text" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Aucun serveur en cours d'exécution</h2>
            <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
              Tous vos serveurs de dev sont actuellement arrêtés. Lancez un serveur depuis l'onglet Projets pour capturer ses logs en temps réel.
            </p>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <button
              onClick={() => onSelectTab && onSelectTab('projects')}
              className="w-full py-2.5 px-4 rounded-xl theme-accent-btn text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span>Accéder aux Projets & Lancer</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {stoppedServers.length > 0 && (
              <button
                onClick={() => setShowAllServers(true)}
                className="w-full py-2 px-4 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-gray-400 hover:text-white text-xs font-medium transition-colors cursor-pointer border border-white/[0.06]"
              >
                Afficher quand même les serveurs arrêtés ({stoppedServers.length})
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fadeIn h-[calc(100vh-5.5rem)] flex flex-col">
      {/* Top Header & Multi-Server Tab Bar */}
      <div className="flex items-center justify-between select-none">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg theme-accent-badge flex items-center justify-center">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">Logs Temps Réel & Multi-Console</h1>
            <p className="text-xs text-gray-400">
              Affichage exclusif des serveurs lancés en cours d'exécution.
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAllServers(!showAllServers)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 border transition-all cursor-pointer ${
              showAllServers
                ? 'theme-accent-badge'
                : 'bg-white/[0.04] border-white/[0.08] text-gray-400 hover:text-white'
            }`}
            title="Basculer entre uniquement les serveurs lancés et tous les serveurs"
          >
            <Filter className="w-3.5 h-3.5" />
            <span>{showAllServers ? 'Tous les serveurs' : `Serveurs Actifs (${runningServers.length})`}</span>
          </button>

          <button
            onClick={toggleSplitMode}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
              isSplitMode
                ? 'theme-accent-btn text-white'
                : 'bg-white/[0.04] border-white/[0.1] text-gray-300 hover:text-white'
            }`}
          >
            <Columns className="w-3.5 h-3.5" />
            <span>{isSplitMode ? 'Mode 2 Consoles (Divisé)' : 'Vue Divisée'}</span>
          </button>
        </div>
      </div>

      {/* Server Tabs Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-white/[0.08] no-scrollbar">
        {displayServers.map((srv) => {
          const isPrimary = srv.id === primaryServer?.id;
          const isSecondary = isSplitMode && srv.id === secondaryServer?.id;
          const isRunning = srv.state === 'running';

          return (
            <div key={srv.id} className="relative group/tab flex items-center">
              <button
                onClick={() => {
                  if (isSplitMode) {
                    if (!isPrimary) {
                      setSplitServerId(srv.id);
                    }
                  } else {
                    setActiveServerId(srv.id);
                  }
                }}
                className={`pl-3.5 pr-8 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer border whitespace-nowrap shrink-0 ${
                  isPrimary
                    ? 'theme-accent-active font-bold border-white/20 shadow-md'
                    : isSecondary
                    ? 'bg-cyan-500/25 border-cyan-500/60 text-cyan-200 shadow-md shadow-cyan-500/20'
                    : 'bg-white/[0.03] border-white/[0.06] text-gray-400 hover:bg-white/[0.08] hover:text-white'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    isRunning ? 'bg-green-400 shadow-md shadow-green-500/50 animate-pulse' : 'bg-gray-600'
                  }`}
                />
                <span className="font-semibold text-white tracking-tight">{srv.projectName}</span>
                <span className="text-[11px] font-mono theme-accent-text font-medium">/ {srv.name}</span>
                <span className="text-[10px] font-mono text-gray-300 bg-black/40 px-1.5 py-0.5 rounded-md border border-white/10 font-bold">
                  :{srv.port}
                </span>
                {isPrimary && (
                  <span className="text-[10px] font-mono font-bold theme-accent-badge px-1.5 py-0.5 rounded-md ml-0.5">
                    1
                  </span>
                )}
                {isSecondary && (
                  <span className="text-[10px] font-mono font-bold bg-cyan-500/30 text-cyan-200 border border-cyan-500/40 px-1.5 py-0.5 rounded-md ml-0.5">
                    2
                  </span>
                )}
              </button>

              {!isRunning && (
                <button
                  onClick={() => {
                    const project = projects.find((p) => (p.servers || []).some((s) => s.id === srv.id));
                    if (project) handleStartServer(srv, project);
                  }}
                  title="Lancer ce serveur"
                  aria-label={`Lancer ${srv.name}`}
                  className="absolute right-1.5 p-0.5 rounded-md bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 opacity-0 group-hover/tab:opacity-100 transition-opacity cursor-pointer"
                >
                  <Play className="w-3 h-3 fill-emerald-400 text-emerald-400" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Main Terminal Grid Area */}
      <div className={`flex-1 grid gap-4 overflow-hidden ${isSplitMode ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <TerminalPanel server={primaryServer} titlePrefix="Console 1" />
        {isSplitMode && <TerminalPanel server={secondaryServer} titlePrefix="Console 2" />}
      </div>
    </div>
  );
}
