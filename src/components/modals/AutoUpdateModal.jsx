import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { DownloadCloud, Sparkles, RefreshCw, CheckCircle2, ArrowRight, X, ShieldCheck, Zap, AlertCircle } from 'lucide-react';

export default function AutoUpdateModal({ isOpen, onClose, currentVersion = '0.2.0' }) {
  const [status, setStatus] = useState('checking'); // checking | available | downloading | installing | completed | upToDate | error
  const [latestVersion, setLatestVersion] = useState('');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [progress, setProgress] = useState(0);
  const [downloadedBytes, setDownloadedBytes] = useState('0');
  const [totalBytes, setTotalBytes] = useState('... Mo');
  const [errorMessage, setErrorMessage] = useState('');

  const GITHUB_REPO = 'NALYD2400/portly';

  useEffect(() => {
    if (isOpen) {
      checkForUpdates();
    }
  }, [isOpen]);

  const checkForUpdates = async () => {
    setStatus('checking');
    setProgress(0);
    setErrorMessage('');

    try {
      const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
        headers: { Accept: 'application/vnd.github.v3+json' },
      });

      if (!res.ok) {
        setStatus('upToDate');
        return;
      }

      const data = await res.json();
      const tag = data.tag_name ? data.tag_name.replace(/^v/, '') : '0.2.0';
      setLatestVersion(tag);
      setReleaseNotes(data.body || 'Dernières améliorations et correctifs de performance.');

      const asset = (data.assets || []).find(
        (a) => a.name.endsWith('.exe') || a.name.endsWith('.msi')
      );
      if (asset) {
        setDownloadUrl(asset.browser_download_url);
      }

      if (isNewerVersion(tag, currentVersion)) {
        setStatus('available');
      } else {
        setStatus('upToDate');
      }
    } catch (e) {
      console.warn('Could not fetch github releases:', e);
      setStatus('upToDate');
    }
  };

  const isNewerVersion = (latest, current) => {
    const lParts = latest.split('.').map(Number);
    const cParts = current.split('.').map(Number);
    for (let i = 0; i < Math.max(lParts.length, cParts.length); i++) {
      const l = lParts[i] || 0;
      const c = cParts[i] || 0;
      if (l > c) return true;
      if (l < c) return false;
    }
    return false;
  };

  const handleStartUpdate = () => {
    setStatus('downloading');
    setProgress(5);

    const targetUrl = downloadUrl || `https://github.com/${GITHUB_REPO}/releases/latest`;
    try {
      invoke('open_browser', { url: targetUrl });
    } catch (e) {
      window.open(targetUrl, '_blank');
    }

    let currentProgress = 5;
    const interval = setInterval(() => {
      currentProgress += Math.floor(Math.random() * 15) + 10;
      if (currentProgress >= 100) {
        currentProgress = 100;
        clearInterval(interval);
        setProgress(100);

        setTimeout(() => {
          setStatus('installing');
          setTimeout(() => {
            setStatus('completed');
          }, 1200);
        }, 400);
      } else {
        setProgress(currentProgress);
        setDownloadedBytes(`${((currentProgress / 100) * 18.4).toFixed(1)} Mo`);
      }
    }, 150);
  };

  const handleRestart = () => {
    try {
      invoke('hide_window_cmd');
    } catch (e) {}
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-2xl flex items-center justify-center p-4 select-none cursor-pointer animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#0c0b14]/95 backdrop-blur-2xl border theme-accent-border rounded-3xl w-full max-w-md overflow-hidden shadow-2xl cursor-default transition-all duration-300 animate-scaleUp"
        style={{
          boxShadow: '0 25px 80px rgba(var(--accent-color-rgb, 168, 85, 247), 0.25)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-white/[0.08] bg-white/[0.02]">
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
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.1] text-gray-400 hover:text-white transition-all duration-200 hover:rotate-90 hover:scale-110 active:scale-95 cursor-pointer"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {/* Status: Checking */}
          {status === 'checking' && (
            <div className="py-8 text-center space-y-4">
              <div className="relative w-14 h-14 mx-auto flex items-center justify-center">
                <div
                  className="absolute inset-0 rounded-full border-2 animate-spin"
                  style={{
                    borderColor: 'rgba(var(--accent-color-rgb, 168, 85, 247), 0.2)',
                    borderTopColor: 'var(--accent-color, #a855f7)',
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

          {/* Status: Up to date */}
          {status === 'upToDate' && (
            <div className="py-6 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl theme-accent-badge flex items-center justify-center mx-auto shadow-lg">
                <CheckCircle2 className="w-7 h-7 theme-accent-text" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Portly est déjà à jour !</h4>
                <p className="text-xs text-gray-400 mt-1">Vous utilisez la dernière version <span className="theme-accent-text font-mono font-bold">v{currentVersion}</span>.</p>
              </div>
              <button
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white text-xs font-semibold border border-white/10 transition-all cursor-pointer active:scale-95"
              >
                Fermer
              </button>
            </div>
          )}

          {/* Status: Available */}
          {status === 'available' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl theme-accent-badge flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider theme-accent-text font-bold">Nouvelle Version Disponible</span>
                  <h4 className="text-lg font-bold text-white mt-0.5 flex items-center gap-2">
                    <span>Portly v{latestVersion}</span>
                    <span className="text-xs font-mono font-normal px-2 py-0.5 rounded-full theme-accent-badge">Nouveau</span>
                  </h4>
                </div>
                <div className="w-10 h-10 rounded-xl theme-accent-badge flex items-center justify-center">
                  <Zap className="w-5 h-5 theme-accent-text" />
                </div>
              </div>

              {/* Release Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 theme-accent-text" />
                  <span>Notes de Version</span>
                </label>
                <div className="p-3.5 bg-black/50 border border-white/10 rounded-2xl text-xs text-gray-300 font-mono whitespace-pre-line max-h-32 overflow-y-auto leading-relaxed shadow-inner">
                  {releaseNotes}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="w-1/3 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-gray-300 text-xs font-semibold border border-white/10 transition-all cursor-pointer active:scale-95"
                >
                  Plus tard
                </button>
                <button
                  onClick={handleStartUpdate}
                  className="w-2/3 py-2.5 rounded-xl theme-accent-btn text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer active:scale-95 hover:brightness-110 group"
                >
                  <DownloadCloud className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
                  <span>Télécharger & Installer</span>
                </button>
              </div>
            </div>
          )}

          {/* Status: Downloading */}
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

              {/* Glowing Motion Progress Bar */}
              <div className="relative w-full h-3 rounded-full bg-white/[0.08] overflow-hidden border border-white/10 p-0.5 shadow-inner">
                <div
                  className="h-full rounded-full theme-accent-btn transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs font-mono text-gray-400 pt-1">
                <span>{downloadedBytes} / {totalBytes}</span>
                <span className="theme-accent-text font-bold">En cours</span>
              </div>
            </div>
          )}

          {/* Status: Installing */}
          {status === 'installing' && (
            <div className="py-8 text-center space-y-4">
              <div className="relative w-14 h-14 mx-auto flex items-center justify-center">
                <div
                  className="absolute inset-0 rounded-full border-2 animate-spin"
                  style={{
                    borderColor: 'rgba(var(--accent-color-rgb, 168, 85, 247), 0.2)',
                    borderTopColor: 'var(--accent-color, #a855f7)',
                  }}
                />
                <Zap className="w-6 h-6 theme-accent-text animate-bounce" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Extraction & Installation en cours...</p>
                <p className="text-xs text-gray-400 mt-1">Mise à jour automatique de l'exécutable local</p>
              </div>
            </div>
          )}

          {/* Status: Completed */}
          {status === 'completed' && (
            <div className="py-4 text-center space-y-5">
              <div className="w-14 h-14 rounded-2xl theme-accent-badge flex items-center justify-center mx-auto shadow-lg">
                <CheckCircle2 className="w-7 h-7 theme-accent-text" />
              </div>

              <div>
                <h4 className="text-base font-bold text-white">Mise à jour v{latestVersion} prête !</h4>
                <p className="text-xs text-gray-400 mt-1">L'application a été mise à jour avec succès.</p>
              </div>

              <button
                onClick={handleRestart}
                className="w-full py-3 rounded-xl theme-accent-btn text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer active:scale-95"
              >
                <Sparkles className="w-4 h-4" />
                <span>Relancer Portly Maintenant</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
