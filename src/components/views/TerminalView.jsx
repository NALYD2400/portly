import React, { useState, useEffect, useMemo, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useServerLogs } from '../../hooks/useTauriIPC';
import {
  Terminal,
  Trash2,
  Copy,
  Check,
  Download,
  Search,
  ArrowDown,
  Columns,
  Play,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import PageHeader from '../ui/PageHeader';
import { triggerToast } from '../../services/toastBus';

// Nombre max de lignes rendues dans le DOM (fenêtre glissante)
const MAX_RENDERED_LINES = 500;

const LogLine = React.memo(function LogLine({ entry, lineNumber, showRaw }) {
  const { isError, isSuccess, isInfo } = entry;
  const text = showRaw ? entry.raw : entry.clean;
  return (
    <div
      className={`flex items-start px-2 py-0.5 rounded leading-relaxed break-all ${
        isError
          ? 'bg-red-500/10 text-red-300'
          : isSuccess
            ? 'bg-emerald-500/10 text-emerald-300'
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
function TerminalPanel({ server, titlePrefix = 'Console', servers, onServerChange }) {
  const { logs, clearLogs } = useServerLogs(server?.id);
  const [filter, setFilter] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [expandedHistory, setExpandedHistory] = useState(false);
  const [level, setLevel] = useState('all');
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef(null);
  const scrollRef = useRef(null);

  // Réglage utilisateur : nettoyage ANSI des logs
  const showRawAnsi = localStorage.getItem('portly_cfg_cleanansi') === 'false';

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const filteredLogs = useMemo(() => {
    const q = filter.toLowerCase();
    return logs.filter(
      (entry) =>
        entry.clean.toLowerCase().includes(q) &&
        (level === 'all' ||
          (level === 'errors' && entry.isError) ||
          (level === 'success' && entry.isSuccess) ||
          (level === 'info' && entry.isInfo)),
    );
  }, [logs, filter, level]);
  useEffect(() => {
    setExpandedHistory(false);
    setFilter('');
    setAutoScroll(true);
  }, [server?.id]);
  useEffect(() => () => clearTimeout(copyTimer.current), []);

  const hiddenByWindow = expandedHistory
    ? 0
    : Math.max(0, filteredLogs.length - MAX_RENDERED_LINES);
  const visibleLogs = expandedHistory ? filteredLogs : filteredLogs.slice(-MAX_RENDERED_LINES);

  const handleCopyLogs = async () => {
    try {
      await navigator.clipboard.writeText(filteredLogs.map((entry) => entry.clean).join('\n'));
      setCopied(true);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      triggerToast({
        title: 'Copie impossible',
        message: String(error),
        type: 'error',
      });
    }
  };
  const exportLogs = () => {
    const url = URL.createObjectURL(
      new Blob([filteredLogs.map((entry) => entry.clean).join('\n')], {
        type: 'text/plain;charset=utf-8',
      }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(server?.name || 'sprint').replace(/[^a-z0-9_-]/gi, '_')}-logs.txt`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="terminal-panel">
      {/* Panel Header */}
      <div className="terminal-toolbar">
        <div className="terminal-server-control flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              server?.state === 'running' ? 'bg-green-500 animate-pulse' : 'bg-gray-600'
            }`}
          />
          <div>
            <select
              className="control-input max-w-56"
              aria-label={titlePrefix}
              value={server?.id || ''}
              onChange={(event) => onServerChange(event.target.value)}
            >
              {servers.length ? (
                servers.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.projectName} · {item.name}
                  </option>
                ))
              ) : (
                <option value="">Aucun serveur</option>
              )}
            </select>
          </div>
        </div>

        <div className="terminal-actions flex items-center gap-1.5 flex-wrap ml-auto">
          <select
            className="control-input"
            aria-label={`Niveau des logs · ${titlePrefix}`}
            value={level}
            onChange={(event) => setLevel(event.target.value)}
          >
            <option value="all">Tous</option>
            <option value="errors">Erreurs</option>
            <option value="success">Succès</option>
            <option value="info">Infos</option>
          </select>
          <div className="relative">
            <Search className="w-3 h-3 text-zinc-400 absolute left-2 top-2" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filtrer..."
              aria-label={`Rechercher dans les logs · ${titlePrefix}`}
              className="control-input log-filter !pl-7"
            />
          </div>

          <button
            onClick={() => setAutoScroll(!autoScroll)}
            aria-pressed={autoScroll}
            className={`icon-button ${
              autoScroll ? 'theme-accent-active' : 'bg-white/[0.04] text-zinc-400'
            }`}
            title="Défilement automatique"
            aria-label="Défilement automatique"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleCopyLogs}
            className="icon-button"
            title="Copier les logs"
            aria-label="Copier les logs filtrés"
            disabled={!filteredLogs.length}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          <button
            className="icon-button"
            title="Exporter les logs"
            aria-label="Exporter les logs filtrés"
            disabled={!filteredLogs.length}
            onClick={exportLogs}
          >
            <Download size={14} />
          </button>

          <button
            onClick={clearLogs}
            className="icon-button hover:text-rose-400"
            title="Effacer"
            aria-label="Effacer les logs"
            disabled={!logs.length}
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
        className="terminal-log-screen flex-1 font-mono text-xs overflow-y-auto space-y-0.5 select-text"
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
              {filter || level !== 'all' ? (
                <>
                  <Search className="w-3 h-3 text-zinc-400" />
                  <span className="text-zinc-300 font-mono">
                    Aucune ligne ne correspond aux filtres.
                  </span>
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
      <div className="terminal-footer">
        <span>
          {filteredLogs.length} lignes
          {filteredLogs.length !== logs.length ? ` sur ${logs.length}` : ''}
        </span>
        <span>{autoScroll ? 'Suivi en direct' : 'Défilement en pause'}</span>
      </div>
    </div>
  );
}

export default function TerminalView({ projects = [], initialServerId, onSelectTab }) {
  // Réglage utilisateur : n'afficher que les serveurs actifs par défaut
  const [showAllServers, setShowAllServers] = useState(
    () => localStorage.getItem('portly_cfg_hidestopped') === 'false',
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

  const runningServers = useMemo(
    () => allServers.filter((s) => s.state === 'running'),
    [allServers],
  );
  const displayServers = showAllServers
    ? allServers
    : runningServers.length > 0
      ? runningServers
      : allServers;

  const [activeServerId, setActiveServerId] = useState(
    initialServerId || (displayServers[0] ? displayServers[0].id : null),
  );
  const [splitServerId, setSplitServerId] = useState(null);
  const [isSplitMode, setIsSplitMode] = useState(false);

  useEffect(() => {
    if (initialServerId) {
      setActiveServerId(initialServerId);
      setShowAllServers(true);
    }
  }, [initialServerId]);

  // Primary Server
  const primaryServer = displayServers.find((s) => s.id === activeServerId) || displayServers[0];

  // Secondary Server: strictly different from primaryServer
  let secondaryServer = displayServers.find(
    (s) => s.id === splitServerId && s.id !== primaryServer?.id,
  );
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
      triggerToast({
        title: 'Lancement impossible',
        message: String(e),
        type: 'error',
      });
    }
  };

  // If 0 servers are running and user hasn't forced "Show All", display clean empty state
  if (runningServers.length === 0 && !showAllServers) {
    const stoppedServers = allServers;
    return (
      <div className="page logs-page animate-fadeIn">
        <PageHeader title="Logs" />
        <div className="flex-1 flex flex-col items-center justify-center text-center">
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
      </div>
    );
  }

  return (
    <div className="page logs-page animate-fadeIn">
      <div className="logs-header flex items-center justify-between select-none">
        <div>
          <h1 className="page-title">Logs</h1>
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
              isSplitMode
                ? 'bg-white/[0.08] text-white'
                : 'text-zinc-400 hover:text-white hover:bg-white/[0.05]'
            }`}
          >
            <Columns className="w-3.5 h-3.5" />
            <span>{isSplitMode ? 'Une console' : 'Deux consoles'}</span>
          </button>
        </div>
      </div>

      <div className="logs-servers flex items-center gap-1 overflow-x-auto no-scrollbar">
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
                    const project = projects.find((p) =>
                      (p.servers || []).some((s) => s.id === srv.id),
                    );
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
      <div className={`terminal-grid ${isSplitMode ? 'split' : ''}`}>
        <TerminalPanel
          server={primaryServer}
          titlePrefix="Console 1"
          servers={displayServers.filter((item) => !isSplitMode || item.id !== secondaryServer?.id)}
          onServerChange={setActiveServerId}
        />
        {isSplitMode && (
          <TerminalPanel
            server={secondaryServer}
            titlePrefix="Console 2"
            servers={displayServers.filter((item) => item.id !== primaryServer?.id)}
            onServerChange={setSplitServerId}
          />
        )}
      </div>
    </div>
  );
}
