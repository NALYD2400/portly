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
function TerminalPanel({ server, titlePrefix = 'Console' }) {
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
    setLevel('all');
    setAutoScroll(true);
  }, [server?.id]);
  useEffect(() => () => clearTimeout(copyTimer.current), []);

  const hiddenByWindow = expandedHistory
    ? 0
    : Math.max(0, filteredLogs.length - MAX_RENDERED_LINES);
  const visibleLogs = expandedHistory ? filteredLogs : filteredLogs.slice(-MAX_RENDERED_LINES);

  useEffect(() => {
    const screen = scrollRef.current;
    if (!screen || !autoScroll) return undefined;
    const follow = () => {
      screen.scrollTop = screen.scrollHeight;
    };
    follow();
    const observer = new ResizeObserver(follow);
    observer.observe(screen);
    return () => observer.disconnect();
  }, [logs, filter, level, expandedHistory, autoScroll]);

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
        <div className="terminal-actions flex items-center gap-1.5 flex-wrap w-full">
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
                      : 'Serveur arrêté. Utilisez « Lancer » au-dessus de la console.'}
                  </span>
                </>
              )}
            </div>
          </div>
        ) : (
          <>
            {hiddenByWindow > 0 && (
              <button
                onClick={() => {
                  setAutoScroll(false);
                  setExpandedHistory(true);
                }}
                className="log-history-button"
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
        {autoScroll ? (
          <span>Suivi en direct</span>
        ) : (
          <button className="log-resume" onClick={() => setAutoScroll(true)}>
            <ArrowDown size={12} /> Reprendre le suivi
          </button>
        )}
      </div>
    </div>
  );
}

function ConsoleSelector({ server, servers, number, otherId, onChange, onStart, pending }) {
  const groups = new Map();
  for (const item of servers) {
    if (!groups.has(item.projectId))
      groups.set(item.projectId, { name: item.projectName, servers: [] });
    groups.get(item.projectId).servers.push(item);
  }
  const running = server?.state === 'running';
  return (
    <div className="console-selector">
      <div className="console-selector-heading">
        <label htmlFor={'console-server-' + number}>Console {number}</label>
        <span className="console-status">
          <span className={'server-dot ' + (running ? 'running' : '')} />
          {server ? (running ? 'En marche' : 'Arrêté') : 'Aucun serveur'}
        </span>
      </div>
      <div className="console-selector-controls">
        <select
          id={'console-server-' + number}
          className="control-input"
          aria-label={'Console ' + number}
          value={server?.id || ''}
          onChange={(event) => onChange(event.target.value)}
        >
          {!server && <option value="">Choisir un serveur</option>}
          {[...groups].map(([id, group]) => (
            <optgroup key={id} label={group.name}>
              {group.servers.map((item) => (
                <option key={item.id} value={item.id} disabled={item.id === otherId}>
                  {item.projectName} · {item.name}
                  {item.port ? ' · :' + item.port : ''}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {server && !running && (
          <button
            className="btn"
            disabled={pending}
            onClick={() => onStart(server)}
            aria-label={'Lancer ' + server.name}
          >
            {pending ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            <span>{pending ? 'Lancement…' : 'Lancer'}</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default function TerminalView({ projects = [], initialServerId, onSelectTab }) {
  const [showAllServers, setShowAllServers] = useState(
    () => localStorage.getItem('portly_cfg_hidestopped') === 'false',
  );
  const allServers = useMemo(
    () =>
      projects.flatMap((project) =>
        (project.servers || []).map((server) => ({
          ...server,
          projectId: project.id,
          projectName: project.name,
          projectRoot: project.root,
        })),
      ),
    [projects],
  );
  const runningServers = allServers.filter((server) => server.state === 'running');
  const [activeServerId, setActiveServerId] = useState(initialServerId || null);
  const [splitServerId, setSplitServerId] = useState(null);
  const [isSplitMode, setIsSplitMode] = useState(false);
  const [startingIds, setStartingIds] = useState(new Set());
  const startingRef = useRef(new Set());

  useEffect(() => {
    if (initialServerId) setActiveServerId(initialServerId);
  }, [initialServerId]);

  // Keep an opened console selected after its server stops, so its last logs remain readable.
  const primaryServer =
    allServers.find((server) => server.id === activeServerId) || runningServers[0] || allServers[0];
  const secondaryServer =
    allServers.find((server) => server.id === splitServerId && server.id !== primaryServer?.id) ||
    runningServers.find((server) => server.id !== primaryServer?.id) ||
    allServers.find((server) => server.id !== primaryServer?.id);
  const primaryId = primaryServer?.id;
  const secondaryId = secondaryServer?.id;
  useEffect(() => {
    if (primaryId && activeServerId !== primaryId) setActiveServerId(primaryId);
  }, [primaryId, activeServerId]);
  useEffect(() => {
    if (isSplitMode && secondaryId && splitServerId !== secondaryId) setSplitServerId(secondaryId);
  }, [isSplitMode, secondaryId, splitServerId]);

  const displayServers = allServers.filter(
    (server) =>
      showAllServers ||
      !runningServers.length ||
      server.state === 'running' ||
      server.id === primaryServer?.id ||
      (isSplitMode && server.id === secondaryServer?.id),
  );
  const handleStartServer = async (server) => {
    if (startingRef.current.has(server.id)) return;
    startingRef.current.add(server.id);
    setStartingIds(new Set(startingRef.current));
    try {
      await invoke('start_server_cmd', {
        serverId: server.id,
        cwd: server.projectRoot,
        command: server.command,
        env: server.env || {},
      });
    } catch (error) {
      triggerToast({ title: 'Lancement impossible', message: String(error), type: 'error' });
    } finally {
      startingRef.current.delete(server.id);
      setStartingIds(new Set(startingRef.current));
    }
  };

  if (!allServers.length)
    return (
      <div className="page logs-page">
        <PageHeader title="Logs" />
        <div className="empty-state flex-1 flex flex-col items-center justify-center gap-3">
          <Terminal size={28} />
          <h2 className="text-sm font-medium">Vos consoles apparaîtront ici</h2>
          <p className="text-xs text-zinc-400">
            Ajoutez un projet et configurez sa commande de lancement.
          </p>
          <button className="btn" onClick={() => onSelectTab?.('projects')}>
            Aller aux projets <ArrowRight size={14} />
          </button>
        </div>
      </div>
    );

  return (
    <div className="page logs-page animate-fadeIn">
      <PageHeader
        title="Logs"
        actions={
          <>
            <label className="logs-stopped-toggle">
              <input
                type="checkbox"
                checked={showAllServers}
                onChange={(event) => setShowAllServers(event.target.checked)}
              />
              Inclure les arrêtés
            </label>
            <button
              className="quiet-button"
              onClick={() => setIsSplitMode((value) => !value)}
              aria-pressed={isSplitMode}
              disabled={allServers.length < 2}
              title="Comparer deux flux de logs"
            >
              <Columns size={14} /> {isSplitMode ? 'Une console' : 'Deux consoles'}
            </button>
          </>
        }
      />
      <div className={'console-selectors ' + (isSplitMode ? 'split' : '')}>
        <ConsoleSelector
          server={primaryServer}
          servers={displayServers}
          number={1}
          otherId={isSplitMode ? secondaryServer?.id : null}
          onChange={setActiveServerId}
          onStart={handleStartServer}
          pending={startingIds.has(primaryServer?.id)}
        />
        {isSplitMode && (
          <ConsoleSelector
            server={secondaryServer}
            servers={displayServers}
            number={2}
            otherId={primaryServer?.id}
            onChange={setSplitServerId}
            onStart={handleStartServer}
            pending={startingIds.has(secondaryServer?.id)}
          />
        )}
      </div>
      <div className={'terminal-grid ' + (isSplitMode ? 'split' : '')}>
        <TerminalPanel server={primaryServer} titlePrefix="Console 1" />
        {isSplitMode && <TerminalPanel server={secondaryServer} titlePrefix="Console 2" />}
      </div>
    </div>
  );
}
