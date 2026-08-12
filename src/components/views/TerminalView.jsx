import React, { useState, useEffect, useRef } from 'react';
import { useServerLogs } from '../../hooks/useTauriIPC';
import { Terminal, Trash2, Copy, Search, ArrowDown, Columns, Maximize2, Zap, Play, Filter, ArrowRight } from 'lucide-react';

function formatLogLine(rawText) {
  if (!rawText) return { cleanText: '', isError: false, isSuccess: false, isInfo: false };
  const cleanText = rawText.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '');
  const lower = cleanText.toLowerCase();

  const isError = lower.includes('error') || lower.includes('failed') || lower.includes('uncaught');
  const isSuccess = lower.includes('ready in') || lower.includes('success') || lower.includes('finished');
  const isInfo = lower.includes('vite') || lower.includes('tauri') || lower.includes('running');

  return { cleanText, isError, isSuccess, isInfo };
}

// Single Terminal Panel Component
function TerminalPanel({ server, titlePrefix = 'Console' }) {
  const { logs, clearLogs } = useServerLogs(server?.id);
  const [filter, setFilter] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const filteredLogs = filter
    ? logs.filter((line) => line.toLowerCase().includes(filter.toLowerCase()))
    : logs;

  const handleCopyLogs = () => {
    const cleanAll = logs.map((l) => formatLogLine(l).cleanText).join('\n');
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
            title="Copier"
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
      <div className="flex-1 font-mono text-xs overflow-y-auto space-y-1 select-text">
        {!server ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-gray-500 italic select-none">
            <span className="text-xs not-italic text-gray-400">
              Aucun autre serveur disponible pour la vue divisée.
            </span>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-gray-500 italic select-none">
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs not-italic">
              <span className={`w-2 h-2 rounded-full ${server?.state === 'running' ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
              <span className="text-gray-300 font-mono">
                {server?.state === 'running' ? `Écoute active du flux (${server?.command || 'cmd'})...` : 'Serveur arrêté. Cliquez sur "Lancer" pour démarrer.'}
              </span>
            </div>
          </div>
        ) : (
          filteredLogs.map((rawLine, idx) => {
            const { cleanText, isError, isSuccess, isInfo } = formatLogLine(rawLine);
            return (
              <div
                key={idx}
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
                <span className="text-gray-600 select-none mr-2.5 text-[10px] min-w-[2.2rem]">
                  {String(idx + 1).padStart(4, ' ')}
                </span>
                <span className="flex-1">{cleanText}</span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

export default function TerminalView({ projects = [], initialServerId, onSelectTab }) {
  const [showAllServers, setShowAllServers] = useState(false);

  // Collect all servers from projects
  const allServers = [];
  projects.forEach((p) => {
    (p.servers || []).forEach((s) => {
      allServers.push({ ...s, projectName: p.name });
    });
  });

  // Filter running servers by default
  const runningServers = allServers.filter((s) => s.state === 'running');
  const displayServers = showAllServers ? allServers : (runningServers.length > 0 ? runningServers : allServers);

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

  // Secondary Server: Guarantee it is strictly different from primaryServer
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

  // If 0 servers are running and user hasn't forced "Show All", display clean empty state
  if (runningServers.length === 0 && !showAllServers) {
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

            <button
              onClick={() => setShowAllServers(true)}
              className="w-full py-2 px-4 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-gray-400 hover:text-white text-xs font-medium transition-colors cursor-pointer border border-white/[0.06]"
            >
              Afficher quand même les serveurs arrêtés ({allServers.length})
            </button>
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
            <button
              key={srv.id}
              onClick={() => {
                if (isSplitMode) {
                  if (!isPrimary) {
                    setSplitServerId(srv.id);
                  }
                } else {
                  setActiveServerId(srv.id);
                }
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer border whitespace-nowrap shrink-0 ${
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
