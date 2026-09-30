import React, { useState, useEffect, useMemo, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useServerLogs } from '../../hooks/useTauriIPC';
import { Terminal, Trash2, Copy, Search, ArrowDown, Columns, Play, ArrowRight, Loader2 } from 'lucide-react';

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
          : 'text-zinc-300 hover:bg-white/[0.02]'
      }`}
    >
      <span className="text-zinc-500 select-none mr-2.5 text-[10px] min-w-[2.2rem] text-right">
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
    <div className="flex-1 flex flex-col h-full rounded-xl p-4 bg-[var(--surface-2)] overflow-hidden select-none">
      {/* Panel Header */}
      <div className="flex items-center justify-between pb-3 mb-2">
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              server?.state === 'running' ? 'bg-green-500 animate-pulse' : 'bg-gray-600'
            }`}
          />
          <div>
            <span className="text-[10px] font-mono uppercase font-semibold mr-1.5 px-1.5 py-0.5 rounded theme-accent-badge">
              {titlePrefix}
            </span>
            <span className="text-xs font-semibold text-white">{server?.name || 'Aucun serveur'}</span>
            {server && <span className="text-[10px] font-mono text-zinc-400 ml-2">:{server.port}</span>}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="relative">
            <Search className="w-3 h-3 text-zinc-400 absolute left-2 top-2" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filtrer..."
              className="pl-7 pr-2 py-1 rounded-lg bg-white/[0.04] border border-transparent text-[11px] text-white placeholder-zinc-600 font-mono w-32"
            />
          </div>

          <button
            onClick={() => setAutoScroll(!autoScroll)}
            aria-pressed={autoScroll}
            className={`p-1.5 rounded-lg text-xs flex items-center transition-colors cursor-pointer ${
              autoScroll ? 'theme-accent-active' : 'bg-white/[0.04] text-zinc-400'
            }`}
            title="Défilement automatique"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleCopyLogs}
            className="p-1.5 rounded-md text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
            title="Copier les logs"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={clearLogs}
            className="p-1.5 rounded-md text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
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
          <div className="h-full flex flex-col items-center justify-center gap-2 text-zinc-500 italic select-none">
            <span className="text-xs not-italic text-zinc-400">
              Aucun autre serveur disponible pour la vue divisée.
            </span>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-zinc-500 italic select-none">
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white/[0.04] border border-[var(--line)] text-xs not-italic">
              {filter ? (
                <>
                  <Search className="w-3 h-3 text-zinc-400" />
                  <span className="text-zinc-300 font-mono">Aucune ligne ne correspond au filtre « {filter} »</span>
                </>
              ) : (
                <>
                  {server?.state === 'running' ? (
                    <Loader2 className="w-3 h-3 text-green-500 animate-spin" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-gray-500" />
                  )}
                  <span className="text-zinc-300 font-mono">
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
                className="w-full text-center text-[10px] font-mono text-zinc-500 hover:text-zinc-300 py-1 border-b border-[var(--line)] cursor-pointer sticky top-0 bg-black/80 z-10"
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
      <div className="animate-fadeIn h-[calc(100vh-8rem)] flex flex-col items-center justify-center select-none text-center">
        <div className="max-w-sm space-y-4">
          <Terminal className="w-8 h-8 text-zinc-600 mx-auto" />
          <div>
            <h2 className="text-sm font-medium text-white">Aucun serveur en cours</h2>
            <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">
              Lancez un serveur depuis vos projets : ses logs s'afficheront ici en direct.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => onSelectTab && onSelectTab('projects')}
              className="h-8 px-3.5 rounded-md theme-accent-btn text-xs font-medium flex items-center gap-2 cursor-pointer"
            >
              <span>Aller aux projets</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            {stoppedServers.length > 0 && (
              <button
                onClick={() => setShowAllServers(true)}
                className="h-8 px-3 rounded-md text-xs text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
              >
                Voir les serveurs arrêtés ({stoppedServers.length})
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fadeIn h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex items-end justify-between select-none">
        <div>
          <h1 className="text-[22px] font-semibold text-zinc-50 tracking-tight">Logs</h1>
          <p className="text-[13px] text-zinc-500 mt-1">Ce que vos serveurs affichent, en direct.</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowAllServers(!showAllServers)}
            className="h-8 px-2.5 rounded-md text-xs text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
            title="Afficher aussi les serveurs arrêtés"
          >
            {showAllServers ? 'Seulement les actifs' : 'Voir tous les serveurs'}
          </button>
          <button
            onClick={toggleSplitMode}
            className={`h-8 px-2.5 rounded-md text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
              isSplitMode ? 'bg-white/[0.08] text-white' : 'text-zinc-400 hover:text-white hover:bg-white/[0.05]'
            }`}
          >
            <Columns className="w-3.5 h-3.5" />
            <span>{isSplitMode ? 'Une console' : 'Deux consoles'}</span>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
        {displayServers.map((srv) => {
          const isPrimary = srv.id === primaryServer?.id;
          const isSecondary = isSplitMode && srv.id === secondaryServer?.id;
          const isRunning = srv.state === 'running';

          return (
            <div key={srv.id} className="relative group/tab flex items-center">
              <button
                onClick={() => {
                  if (isSplitMode) {
                    if (!isPrimary) setSplitServerId(srv.id);
                  } else {
                    setActiveServerId(srv.id);
                  }
                }}
                className={`h-8 pl-3 pr-3 rounded-md text-xs flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  isPrimary || isSecondary
                    ? 'bg-white/[0.08] text-white'
                    : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04]'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${isRunning ? 'bg-emerald-400' : 'bg-zinc-600'}`}
                />
                <span>{srv.projectName}</span>
                <span className="text-zinc-500">{srv.name}</span>
              </button>

              {!isRunning && (
                <button
                  onClick={() => {
                    const project = projects.find((p) => (p.servers || []).some((s) => s.id === srv.id));
                    if (project) handleStartServer(srv, project);
                  }}
                  title="Lancer ce serveur"
                  aria-label={`Lancer ${srv.name}`}
                  className="w-6 h-6 flex items-center justify-center rounded-md text-emerald-300 hover:bg-emerald-500/15 transition-colors cursor-pointer"
                >
                  <Play className="w-3 h-3 fill-current" />
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
