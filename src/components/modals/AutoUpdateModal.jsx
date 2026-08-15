import React, { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { DownloadCloud, Sparkles, RefreshCw, CheckCircle2, X, Zap, AlertCircle } from 'lucide-react';
import Modal from '../ui/Modal';

const GITHUB_REPO = 'NALYD2400/portly';

function isNewerVersion(latest, current) {
  if (!latest || !current) return false;
  const cleanL = latest.replace(/^v/, '').trim();
  const cleanC = current.replace(/^v/, '').trim();
  const lParts = cleanL.split('.').map((p) => parseInt(p, 10) || 0);
  const cParts = cleanC.split('.').map((p) => parseInt(p, 10) || 0);
  for (let i = 0; i < Math.max(lParts.length, cParts.length); i++) {
    const l = lParts[i] || 0;
    const c = cParts[i] || 0;
    if (l > c) return true;
    if (l < c) return false;
  }
  return false;
}

export default function AutoUpdateModal({ isOpen, onClose, currentVersion }) {
  const [status, setStatus] = useState('checking'); // checking | available | downloading | installing | completed | upToDate | error
  const [latestVersion, setLatestVersion] = useState('');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [installerPath, setInstallerPath] = useState('');
  const [progress, setProgress] = useState(0);
  const [downloadedBytes, setDownloadedBytes] = useState('0');
  const [totalBytes, setTotalBytes] = useState('... Mo');
  const [errorMessage, setErrorMessage] = useState('');
  const mountedRef = useRef(true);

  // Le téléchargement/ l'installation verrouillent la fermeture de la modal
  const isBusy = status === 'downloading' || status === 'installing';

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const checkForUpdates = useCallback(
    async (signal) => {
      setStatus('checking');
      setProgress(0);
      setErrorMessage('');

      try {
        const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
          headers: { Accept: 'application/vnd.github.v3+json' },
          signal,
        });

        if (!res.ok) {
          if (res.status === 403) {
            setErrorMessage('Limite de requêtes GitHub API atteinte (60 req/h). Réessayez plus tard.');
          } else {
            setErrorMessage(`Serveur GitHub indisponible (code HTTP ${res.status}).`);
          }
          setStatus('error');
          return;
        }

        const data = await res.json();
        const tag = data.tag_name ? data.tag_name.replace(/^v/, '').trim() : '';
        setLatestVersion(tag);
        setReleaseNotes(data.body || 'Dernières améliorations et correctifs de performance.');

        const asset = (data.assets || []).find(
          (a) => a.name.toLowerCase().endsWith('.exe') || a.name.toLowerCase().endsWith('.msi')
        );
        if (asset) {
          setDownloadUrl(asset.browser_download_url);
        } else if (tag) {
          setDownloadUrl(`https://github.com/${GITHUB_REPO}/releases/download/v${tag}/Portly_${tag}_x64-setup.exe`);
        }

        if (tag && isNewerVersion(tag, currentVersion)) {
          setStatus('available');
        } else {
          setStatus('upToDate');
        }
      } catch (e) {
        if (e.name === 'AbortError' || !mountedRef.current) return;
        setErrorMessage('Impossible de se connecter aux serveurs GitHub Releases.');
        setStatus('error');
      }
    },
    [currentVersion]
  );

  useEffect(() => {
    if (!isOpen) return undefined;
    const controller = new AbortController();
    checkForUpdates(controller.signal);
    return () => controller.abort();
  }, [isOpen, checkForUpdates]);

  const handleStartUpdate = async () => {
    setStatus('downloading');
    setProgress(0);
    setErrorMessage('');

    let unlisten = null;
    try {
      unlisten = await listen('update-progress', (event) => {
        if (!mountedRef.current) return;
        const payload = event.payload;
        if (payload && payload.percentage !== undefined) {
          setProgress(payload.percentage);
          if (payload.downloaded !== undefined && payload.total) {
            setDownloadedBytes(`${(payload.downloaded / (1024 * 1024)).toFixed(1)} Mo`);
            setTotalBytes(`${(payload.total / (1024 * 1024)).toFixed(1)} Mo`);
          }
        }
      });
    } catch (e) {
      console.warn('Could not listen to update-progress:', e);
    }

    try {
      const targetUrl =
        downloadUrl ||
        `https://github.com/${GITHUB_REPO}/releases/download/v${latestVersion}/Portly_${latestVersion}_x64-setup.exe`;
      const downloadedPath = await invoke('download_update_cmd', { url: targetUrl });
      if (!mountedRef.current) return;
      setInstallerPath(downloadedPath);
      setStatus('completed');
    } catch (err) {
      if (!mountedRef.current) return;
      setErrorMessage(typeof err === 'string' ? err : err?.message || String(err));
      setStatus('error');
    } finally {
      if (unlisten) unlisten();
    }
  };

  const handleRestart = async () => {
    setStatus('installing');
    try {
      await invoke('install_update_and_relaunch_cmd', { installerPath });
    } catch (e) {
      if (!mountedRef.current) return;
      setErrorMessage(typeof e === 'string' ? e : e?.message || String(e));
      setStatus('error');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} dismissible={!isBusy} maxWidth="max-w-md">
      <div style={{ boxShadow: '0 25px 80px rgba(var(--accent-color-rgb), 0.25)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl theme-accent-badge flex items-center justify-center shadow-lg">
              <DownloadCloud className="w-5 h-5 theme-accent-text" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>Mise à Jour Portly</span>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full theme-accent-badge">
                  v{currentVersion}
                </span>
              </h3>
              <p className="text-xs text-gray-400">Centre de mise à jour automatique</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            aria-label="Fermer"
            className="p-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.1] text-gray-400 hover:text-white transition-all duration-200 hover:rotate-90 hover:scale-110 active:scale-95 cursor-pointer disabled:opacity-30 disabled:hover:rotate-0 disabled:cursor-not-allowed"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {status === 'checking' && (
            <div className="py-8 text-center space-y-4">
              <div className="relative w-14 h-14 mx-auto flex items-center justify-center">
                <div
                  className="absolute inset-0 rounded-full border-2 animate-spin"
                  style={{
                    borderColor: 'rgba(var(--accent-color-rgb), 0.2)',
                    borderTopColor: 'var(--accent-color)',
                  }}
                />
                <Sparkles className="w-6 h-6 theme-accent-text animate-pulse" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Recherche de mise à jour...</p>
                <p className="text-xs text-gray-400 mt-1">Connexion aux serveurs GitHub Releases</p>
              </div>
            </div>
          )}

          {status === 'upToDate' && (
            <div className="py-6 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl theme-accent-badge flex items-center justify-center mx-auto shadow-lg">
                <CheckCircle2 className="w-7 h-7 theme-accent-text" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Portly est déjà à jour !</h4>
                <p className="text-xs text-gray-400 mt-1">
                  Vous utilisez la dernière version <span className="theme-accent-text font-mono font-bold">v{currentVersion}</span>.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white text-xs font-semibold border border-white/10 transition-all cursor-pointer active:scale-95"
              >
                Fermer
              </button>
            </div>
          )}

          {status === 'available' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl theme-accent-badge flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider theme-accent-text font-bold">
                    Nouvelle Version Disponible
                  </span>
                  <h4 className="text-lg font-bold text-white mt-0.5 flex items-center gap-2">
                    <span>Portly v{latestVersion}</span>
                    <span className="text-xs font-mono font-normal px-2 py-0.5 rounded-full theme-accent-badge">Nouveau</span>
                  </h4>
                </div>
                <div className="w-10 h-10 rounded-xl theme-accent-badge flex items-center justify-center">
                  <Zap className="w-5 h-5 theme-accent-text" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 theme-accent-text" />
                  <span>Notes de Version</span>
                </label>
                <div className="p-3.5 bg-black/50 border border-white/10 rounded-2xl text-xs text-gray-300 font-mono whitespace-pre-line max-h-32 overflow-y-auto leading-relaxed shadow-inner">
                  {releaseNotes}
                </div>
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-1/3 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-gray-300 text-xs font-semibold border border-white/10 transition-all cursor-pointer active:scale-95"
                >
                  Plus tard
                </button>
                <button
                  type="button"
                  onClick={handleStartUpdate}
                  className="w-2/3 py-2.5 rounded-xl theme-accent-btn text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer active:scale-95 hover:brightness-110 group"
                >
                  <DownloadCloud className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
                  <span>Télécharger & Installer</span>
                </button>
              </div>
            </div>
          )}

          {status === 'downloading' && (
            <div className="space-y-5 py-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 theme-accent-text animate-spin" />
                    <span>Téléchargement de Portly v{latestVersion}</span>
                  </h4>
                  <p className="text-xs text-gray-400 mt-0.5">Transfert sécurisé depuis GitHub Releases</p>
                </div>
                <span className="text-xl font-bold font-mono theme-accent-text">{progress}%</span>
              </div>

              <div
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                className="relative w-full h-3 rounded-full bg-white/[0.08] overflow-hidden border border-white/10 p-0.5 shadow-inner"
              >
                <div
                  className="h-full rounded-full theme-accent-btn transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs font-mono text-gray-400 pt-1">
                <span>
                  {downloadedBytes} / {totalBytes}
                </span>
                <span className="theme-accent-text font-bold">En cours</span>
              </div>
            </div>
          )}

          {status === 'installing' && (
            <div className="py-8 text-center space-y-4">
              <div className="relative w-14 h-14 mx-auto flex items-center justify-center">
                <div
                  className="absolute inset-0 rounded-full border-2 animate-spin"
                  style={{
                    borderColor: 'rgba(var(--accent-color-rgb), 0.2)',
                    borderTopColor: 'var(--accent-color)',
                  }}
                />
                <Zap className="w-6 h-6 theme-accent-text animate-bounce" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Lancement de l'installateur Windows...</p>
                <p className="text-xs text-gray-400 mt-1">L'application va se fermer pour appliquer la mise à jour.</p>
              </div>
            </div>
          )}

          {status === 'completed' && (
            <div className="py-4 text-center space-y-5">
              <div className="w-14 h-14 rounded-2xl theme-accent-badge flex items-center justify-center mx-auto shadow-lg">
                <CheckCircle2 className="w-7 h-7 theme-accent-text" />
              </div>

              <div>
                <h4 className="text-base font-bold text-white">Mise à jour v{latestVersion} téléchargée !</h4>
                <p className="text-xs text-gray-400 mt-1">L'installateur est prêt. Cliquez pour appliquer et relancer.</p>
              </div>

              <button
                type="button"
                onClick={handleRestart}
                className="w-full py-3 rounded-xl theme-accent-btn text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer active:scale-95"
              >
                <Sparkles className="w-4 h-4" />
                <span>Installer & Relancer Portly</span>
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className="py-6 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center mx-auto shadow-lg">
                <AlertCircle className="w-7 h-7 text-red-400" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Échec de la mise à jour</h4>
                <p className="text-xs text-red-300 mt-1 max-w-xs mx-auto break-words">{errorMessage}</p>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-1/2 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-gray-300 text-xs font-semibold border border-white/10 transition-all cursor-pointer active:scale-95"
                >
                  Fermer
                </button>
                <button
                  type="button"
                  onClick={() => checkForUpdates(undefined)}
                  className="w-1/2 py-2.5 rounded-xl theme-accent-btn text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg transition-all cursor-pointer active:scale-95"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Réessayer</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
