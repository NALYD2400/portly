import React, { useState, useEffect, useMemo, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Globe,
  RotateCw,
  ExternalLink,
  Monitor,
  Tablet,
  Smartphone,
  Copy,
  Check,
  Radio,
  Terminal,
  Columns,
  Minimize2,
  QrCode,
  Play,
  Square,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { triggerToast } from '../../services/toastBus';
import { useServerLogs, markManualStop } from '../../hooks/useTauriIPC';

export default function BrowserView({
  projects = [],
  initialServerId = null,
  initialUrl = null,
  onSelectTab,
}) {
  // Liste de tous les serveurs configurés
  const allServers = useMemo(() => {
    const list = [];
    projects.forEach((p) => {
      (p.servers || []).forEach((s) => {
        if (s.port || s.state === 'running') {
          list.push({
            ...s,
            projectId: p.id,
            projectName: p.name,
            projectColor: p.color || 'var(--accent-color)',
            projectRoot: p.root,
            url: `http://localhost:${s.port || 3000}`,
          });
        }
      });
    });
    return list;
  }, [projects]);

  const runningServers = allServers.filter((s) => s.state === 'running');

  // Serveur sélectionné
  const [selectedServerId, setSelectedServerId] = useState(() => {
    if (initialServerId && allServers.some((s) => s.id === initialServerId)) {
      return initialServerId;
    }
    return runningServers.length > 0
      ? runningServers[0].id
      : allServers.length > 0
      ? allServers[0].id
      : null;
  });

  const selectedServer =
    allServers.find((s) => s.id === selectedServerId) ||
    runningServers[0] ||
    allServers[0];

  // URL et iframe
  const [currentUrl, setCurrentUrl] = useState(
    initialUrl || (selectedServer ? selectedServer.url : 'http://localhost:3000')
  );
  const [urlInput, setUrlInput] = useState(currentUrl);
  const [iframeKey, setIframeKey] = useState(0);

  // Modes d'affichage: 'desktop', 'tablet', 'mobile', 'dual'
  const [deviceMode, setDeviceMode] = useState('desktop');
  const [showLogsDrawer, setShowLogsDrawer] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isLiveOnline, setIsLiveOnline] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [localIp, setLocalIp] = useState('127.0.0.1');
  const [showQrModal, setShowQrModal] = useState(false);
  const [serverMenuOpen, setServerMenuOpen] = useState(false);

  // Récupérer l'IP locale pour le QR Code
  useEffect(() => {
    invoke('get_local_ip_cmd')
      .then((ip) => {
        if (ip) setLocalIp(ip);
      })
      .catch(() => {
        setLocalIp('127.0.0.1');
      });
  }, []);

  // Synchronisation avec initialServerId
  useEffect(() => {
    if (initialServerId) {
      setSelectedServerId(initialServerId);
      const found = allServers.find((s) => s.id === initialServerId);
      if (found) {
        setCurrentUrl(found.url);
        setUrlInput(found.url);
      }
    }
  }, [initialServerId, allServers]);

  // Vérifier la connectivité du port en continu
  useEffect(() => {
    if (!selectedServer?.port) {
      setIsLiveOnline(false);
      return undefined;
    }

    const checkPort = async () => {
      try {
        const isUp = await invoke('ping_port_cmd', { port: selectedServer.port });
        setIsLiveOnline(!!isUp);
      } catch {
        setIsLiveOnline(false);
      }
    };

    checkPort();
    const interval = setInterval(checkPort, 2500);
    return () => clearInterval(interval);
  }, [selectedServer, iframeKey]);

  // Fermer le menu des serveurs lors d'un clic extérieur
  useEffect(() => {
    if (!serverMenuOpen) return;
    const handleDown = (e) => {
      if (!e.target.closest('[data-server-picker]')) {
        setServerMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleDown);
    return () => document.removeEventListener('pointerdown', handleDown);
  }, [serverMenuOpen]);

  // Logs du terminal
  const { logs, clearLogs } = useServerLogs(selectedServer?.id);
  const logsEndRef = useRef(null);

  useEffect(() => {
    if (showLogsDrawer && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, showLogsDrawer]);

  const handleSelectServer = (srv) => {
    setSelectedServerId(srv.id);
    setCurrentUrl(srv.url);
    setUrlInput(srv.url);
    setServerMenuOpen(false);
    setIframeKey((prev) => prev + 1);
  };

  const handleNavigateUrl = (e) => {
    e.preventDefault();
    let target = urlInput.trim();
    if (!target) return;
    if (!target.startsWith('http://') && !target.startsWith('https://')) {
      if (target.startsWith('/')) {
        target = `http://localhost:${selectedServer?.port || 3000}${target}`;
      } else {
        target = `http://${target}`;
      }
    }
    setCurrentUrl(target);
    setUrlInput(target);
    setIframeKey((prev) => prev + 1);
  };

  const handleRefresh = () => {
    setIframeKey((prev) => prev + 1);
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    triggerToast({
      title: '📋 URL Copiée',
      message: `${currentUrl} copié dans le presse-papier.`,
      type: 'info',
      duration: 2000,
    });
  };

  const handleOpenExternal = () => {
    invoke('open_browser', { url: currentUrl }).catch((e) => {
      triggerToast({ title: '⚠️ Navigateur', message: String(e), type: 'error' });
    });
  };

  const handleStartServer = async () => {
    if (!selectedServer) return;
    setIsStarting(true);
    try {
      await invoke('start_server_cmd', {
        serverId: selectedServer.id,
        cwd: selectedServer.projectRoot,
        command: selectedServer.command,
        env: selectedServer.env || {},
      });

      let attempts = 0;
      const pollTimer = setInterval(async () => {
        attempts++;
        try {
          const up = await invoke('ping_port_cmd', { port: selectedServer.port });
          if (up || attempts > 20) {
            clearInterval(pollTimer);
            setIsStarting(false);
            if (up) {
              setIsLiveOnline(true);
              setIframeKey((prev) => prev + 1);
              triggerToast({
                title: '⚡ Serveur en Ligne !',
                message: `${selectedServer.projectName} écoute sur le port :${selectedServer.port}`,
                type: 'success',
              });
            }
          }
        } catch {
          if (attempts > 20) {
            clearInterval(pollTimer);
            setIsStarting(false);
          }
        }
      }, 500);
    } catch (e) {
      setIsStarting(false);
      triggerToast({
        title: '⚠️ Échec du Démarrage',
        message: String(e),
        type: 'error',
      });
    }
  };

  const handleStopServer = async () => {
    if (!selectedServer) return;
    markManualStop(selectedServer.id);
    try {
      await invoke('stop_server_cmd', { serverId: selectedServer.id });
      setIsLiveOnline(false);
      triggerToast({
        title: '⏹ Serveur Arrêté',
        message: `Le serveur ${selectedServer.name} a été arrêté.`,
        type: 'info',
      });
    } catch (e) {
      triggerToast({
        title: "⚠️ Échec de l'Arrêt",
        message: String(e),
        type: 'error',
      });
    }
  };

  const lanUrl = selectedServer?.port ? `http://${localIp}:${selectedServer.port}` : currentUrl;
  const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
    lanUrl
  )}&bgcolor=0b0c16&color=a855f7&margin=10`;

  // Rendu de la page web ou écran hors-ligne
  const renderIframeContent = (keySuffix) => {
    if (!isLiveOnline) {
      return (
        <div className="w-full h-full bg-[#0a0a12] flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="max-w-xs space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center mx-auto text-gray-400">
              <Globe className="w-6 h-6 theme-accent-text" />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-white">
                {selectedServer ? selectedServer.projectName : 'Aucun serveur actif'}
              </h3>
              <p className="text-xs text-gray-500 font-mono mt-0.5">
                {selectedServer ? `Port :${selectedServer.port || 3000} • Arrêté` : 'Sélectionnez un projet'}
              </p>
            </div>

            {selectedServer && (
              <button
                type="button"
                onClick={handleStartServer}
                disabled={isStarting}
                className="w-full py-2 px-4 rounded-xl theme-accent-btn text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 active:scale-95"
              >
                {isStarting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Démarrage...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>Démarrer le serveur</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      );
    }

    return (
      <iframe
        key={`${keySuffix}-${iframeKey}`}
        src={currentUrl}
        title="Web Preview"
        className="w-full h-full border-0 bg-white"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    );
  };

  return (
    <div className="h-full flex flex-col space-y-3 animate-fadeIn select-none overflow-hidden pb-2">
      {/* Barre de navigation unique, épurée et moderne */}
      <div className="glass-panel px-3 py-2 rounded-2xl border border-white/[0.08] flex items-center justify-between gap-3 shrink-0">
        {/* Sélecteur de Serveur */}
        <div className="relative shrink-0" data-server-picker>
          {allServers.length === 0 ? (
            <div className="text-xs text-gray-500 font-mono px-2">Aucun serveur</div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setServerMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] text-xs font-medium text-white transition-all cursor-pointer"
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isLiveOnline ? 'bg-emerald-400 shadow-[0_0_6px_#10b981] animate-pulse' : 'bg-gray-600'
                  }`}
                />
                <span className="font-semibold truncate max-w-[150px]">
                  {selectedServer?.projectName || selectedServer?.name}
                </span>
                <span className="text-[10px] font-mono text-gray-400">
                  :{selectedServer?.port || 3000}
                </span>
                <ChevronDown className="w-3 h-3 text-gray-400 ml-0.5" />
              </button>

              {serverMenuOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-64 rounded-xl p-1 shadow-2xl z-50 text-xs select-none bg-[#131224]/95 backdrop-blur-xl border border-white/15 animate-scaleUp">
                  {allServers.map((srv) => {
                    const isSelected = srv.id === selectedServer?.id;
                    const isRunning = srv.state === 'running';
                    return (
                      <button
                        key={srv.id}
                        type="button"
                        onClick={() => handleSelectServer(srv)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-white/[0.1] text-white font-semibold'
                            : 'text-gray-300 hover:text-white hover:bg-white/[0.05]'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              isRunning ? 'bg-emerald-400' : 'bg-gray-600'
                            }`}
                          />
                          <span className="truncate">{srv.projectName}</span>
                          <span className="text-[10px] text-gray-500 font-mono">({srv.name})</span>
                        </div>
                        <span className="text-[10px] font-mono text-gray-400 shrink-0">:{srv.port}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Barre d'adresse URL */}
        <div className="flex-1 flex items-center gap-1.5 max-w-xl">
          <button
            type="button"
            onClick={handleRefresh}
            className="p-1.5 rounded-lg hover:bg-white/[0.08] text-gray-400 hover:text-white transition-colors cursor-pointer shrink-0"
            title="Recharger la page"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>

          <form onSubmit={handleNavigateUrl} className="flex-1 relative">
            <div className="flex items-center bg-white/[0.03] border border-white/[0.08] rounded-xl px-2.5 py-1 text-xs text-white focus-within:border-white/20 transition-colors">
              <Globe className="w-3 h-3 text-gray-400 shrink-0 mr-2" />
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="http://localhost:3000..."
                className="w-full bg-transparent text-xs font-mono text-white focus:outline-none placeholder-gray-500"
              />
              <div className="flex items-center gap-1 shrink-0 ml-1">
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="p-1 hover:text-white text-gray-400 transition-colors cursor-pointer"
                  title="Copier l'URL"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
                <button
                  type="button"
                  onClick={handleOpenExternal}
                  className="p-1 hover:text-white text-gray-400 transition-colors cursor-pointer"
                  title="Ouvrir dans le navigateur externe"
                >
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Sélecteur de Format / Device Responsive */}
        <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.08] p-0.5 rounded-xl shrink-0">
          <button
            type="button"
            onClick={() => setDeviceMode('desktop')}
            className={`px-2 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
              deviceMode === 'desktop'
                ? 'bg-white/[0.12] text-white shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
            title="Plein écran (100%)"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Desktop</span>
          </button>

          <button
            type="button"
            onClick={() => setDeviceMode('tablet')}
            className={`px-2 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
              deviceMode === 'tablet'
                ? 'bg-white/[0.12] text-white shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
            title="Format Tablette (768px)"
          >
            <Tablet className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Tablette</span>
          </button>

          <button
            type="button"
            onClick={() => setDeviceMode('mobile')}
            className={`px-2 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
              deviceMode === 'mobile'
                ? 'bg-white/[0.12] text-white shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
            title="Format Mobile (375px)"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Mobile</span>
          </button>

          <button
            type="button"
            onClick={() => setDeviceMode('dual')}
            className={`px-2 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
              deviceMode === 'dual'
                ? 'bg-white/[0.12] text-white shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
            title="Vue côte à côte (Desktop + Mobile)"
          >
            <Columns className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Dual</span>
          </button>
        </div>

        {/* Actions Rapides (QR Code Smartphone & Logs) */}
        <div className="flex items-center gap-1 shrink-0">
          {selectedServer && (
            isLiveOnline ? (
              <button
                type="button"
                onClick={handleStopServer}
                className="p-1.5 rounded-lg hover:bg-rose-500/20 text-gray-400 hover:text-rose-300 transition-colors cursor-pointer"
                title="Arrêter ce serveur"
              >
                <Square className="w-3.5 h-3.5 fill-rose-400 text-rose-400" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartServer}
                disabled={isStarting}
                className="p-1.5 rounded-lg hover:bg-emerald-500/20 text-gray-400 hover:text-emerald-300 transition-colors cursor-pointer"
                title="Démarrer ce serveur"
              >
                <Play className="w-3.5 h-3.5 fill-emerald-400 text-emerald-400" />
              </button>
            )
          )}

          <button
            type="button"
            onClick={() => setShowQrModal(true)}
            className="p-1.5 rounded-lg hover:bg-white/[0.08] text-gray-400 hover:text-white transition-colors cursor-pointer"
            title="Tester sur smartphone via QR Code"
          >
            <QrCode className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setShowLogsDrawer(!showLogsDrawer)}
            className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
              showLogsDrawer
                ? 'bg-white/[0.12] text-white'
                : 'hover:bg-white/[0.08] text-gray-400 hover:text-white'
            }`}
            title="Afficher les logs en direct"
          >
            <Terminal className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Zone Principale de Prévisualisation */}
      <div className="flex-1 flex flex-col min-h-0 relative">
        <div className="flex-1 bg-[#06070d] rounded-2xl border border-white/[0.06] p-3 flex items-center justify-center overflow-auto relative">
          {deviceMode === 'dual' ? (
            /* Vue Dual : Desktop (flexible) + Mobile (375px) côte à côte */
            <div className="w-full h-full flex items-center justify-center gap-4 p-1 overflow-auto">
              {/* Cadre Desktop */}
              <div className="flex-1 h-full rounded-xl overflow-hidden border border-white/10 shadow-xl flex flex-col bg-white">
                <div className="h-6 bg-[#10111a] border-b border-white/[0.06] flex items-center justify-between px-3 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-white/20" />
                    <span className="w-2 h-2 rounded-full bg-white/20" />
                    <span className="w-2 h-2 rounded-full bg-white/20" />
                  </div>
                  <span className="text-[10px] font-mono text-gray-400">Desktop</span>
                  <div className="w-8" />
                </div>
                <div className="flex-1 relative overflow-hidden">
                  {renderIframeContent('dual-desktop')}
                </div>
              </div>

              {/* Cadre Mobile */}
              <div className="w-[375px] h-full rounded-xl overflow-hidden border border-white/10 shadow-xl flex flex-col bg-white shrink-0">
                <div className="h-6 bg-[#10111a] border-b border-white/[0.06] flex items-center justify-between px-3 shrink-0">
                  <span className="text-[10px] font-mono text-gray-400">Mobile (375px)</span>
                </div>
                <div className="flex-1 relative overflow-hidden">
                  {renderIframeContent('dual-mobile')}
                </div>
              </div>
            </div>
          ) : deviceMode === 'mobile' ? (
            /* Vue Mobile seule */
            <div className="w-[375px] h-full max-h-[750px] rounded-xl overflow-hidden border border-white/10 shadow-2xl flex flex-col bg-white">
              <div className="h-6 bg-[#10111a] border-b border-white/[0.06] flex items-center justify-between px-3 shrink-0">
                <span className="text-[10px] font-mono text-gray-400">Mobile (375 × 812)</span>
              </div>
              <div className="flex-1 relative overflow-hidden">
                {renderIframeContent('mobile-single')}
              </div>
            </div>
          ) : deviceMode === 'tablet' ? (
            /* Vue Tablette seule */
            <div className="w-[768px] h-full max-h-[820px] rounded-xl overflow-hidden border border-white/10 shadow-2xl flex flex-col bg-white">
              <div className="h-6 bg-[#10111a] border-b border-white/[0.06] flex items-center justify-between px-3 shrink-0">
                <span className="text-[10px] font-mono text-gray-400">Tablette (768 × 1024)</span>
              </div>
              <div className="flex-1 relative overflow-hidden">
                {renderIframeContent('tablet-single')}
              </div>
            </div>
          ) : (
            /* Vue Plein Écran Desktop (100%) */
            <div className="w-full h-full rounded-xl overflow-hidden border border-white/10 shadow-xl flex flex-col bg-white">
              {renderIframeContent('desktop-full')}
            </div>
          )}
        </div>

        {/* Tiroir de Logs Rétractable */}
        {showLogsDrawer && (
          <div className="mt-2.5 h-44 rounded-xl glass-panel border border-white/10 bg-black/90 p-2.5 flex flex-col overflow-hidden shadow-2xl animate-slideUp">
            <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.08] mb-1.5">
              <div className="flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 theme-accent-text" />
                <span className="text-xs font-bold text-white">
                  Logs en direct : {selectedServer?.name} (:{selectedServer?.port})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={clearLogs}
                  className="px-2 py-0.5 rounded bg-white/[0.04] hover:bg-rose-500/20 text-gray-400 hover:text-rose-400 text-[10px] font-mono transition-colors cursor-pointer"
                >
                  Effacer
                </button>
                <button
                  type="button"
                  onClick={() => setShowLogsDrawer(false)}
                  className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
                >
                  <Minimize2 className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto font-mono text-[11px] space-y-0.5 text-gray-300 select-text">
              {logs.length === 0 ? (
                <div className="text-gray-600 italic py-3 text-center">Aucun log récent pour ce serveur.</div>
              ) : (
                logs.slice(-150).map((l, i) => (
                  <div key={l.id || i} className="hover:bg-white/[0.02] px-1 py-0.5 rounded leading-relaxed break-all">
                    <span
                      className={`${
                        l.isError
                          ? 'text-rose-400'
                          : l.isSuccess
                          ? 'text-emerald-400'
                          : l.isInfo
                          ? 'theme-accent-text'
                          : 'text-gray-300'
                      }`}
                    >
                      {l.clean || l.raw}
                    </span>
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          </div>
        )}
      </div>

      {/* Modal QR Code Smartphone */}
      {showQrModal && (
        <div
          onClick={() => setShowQrModal(false)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 select-none cursor-pointer animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="glass-panel p-5 rounded-2xl border border-white/15 max-w-xs w-full bg-[#0d0b1a] shadow-2xl text-center space-y-3.5 cursor-default animate-scaleUp"
          >
            <div className="w-10 h-10 rounded-xl theme-accent-btn flex items-center justify-center mx-auto shadow-md">
              <QrCode className="w-5 h-5 text-white" />
            </div>

            <div>
              <h3 className="text-sm font-bold text-white">Tester sur Mobile</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Scannez avec votre téléphone (sur le même réseau Wi-Fi).
              </p>
            </div>

            <div className="p-2.5 bg-black/60 rounded-xl border border-white/10 inline-block shadow-inner">
              <img
                src={qrCodeImageUrl}
                alt="QR Code"
                className="w-48 h-48 rounded-lg mx-auto"
              />
            </div>

            <div className="p-2 rounded-lg bg-white/[0.04] border border-white/10 font-mono text-[11px] text-emerald-400 select-all flex items-center justify-between gap-2">
              <span className="truncate">{lanUrl}</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(lanUrl);
                  triggerToast({ title: '📋 Copié !', message: lanUrl, type: 'info' });
                }}
                className="p-1 text-gray-400 hover:text-white transition-colors cursor-pointer shrink-0"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowQrModal(false)}
              className="w-full py-2 rounded-xl theme-accent-btn text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
