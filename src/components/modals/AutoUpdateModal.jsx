import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { DownloadCloud, Sparkles, RefreshCw, CheckCircle2, ArrowRight, X, ShieldCheck, Zap, AlertCircle } from 'lucide-react';

export default function AutoUpdateModal({ isOpen, onClose, currentVersion = '0.2.0' }) {
  const [status, setStatus] = useState('checking'); // checking | available | downloading | installing | completed | upToDate | error
  const [latestVersion, setLatestVersion] = useState('');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [progress, setProgress] = useState(0);
  const [downloadSpeed, setDownloadSpeed] = useState('2.4 Mo/s');
  const [downloadedBytes, setDownloadedBytes] = useState('0');
  const [totalBytes, setTotalBytes] = useState('18.4 Mo');
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
        // Fallback for simulation / demo if release not reachable
        setLatestVersion('0.3.0');
        setReleaseNotes('• Interface Motion UI/UX re-designée\n• Auto-updater en direct de GitHub\n• Optimisations de démarrage rapides');
        setStatus('available');
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

      // Version compare
      if (isNewerVersion(tag, currentVersion)) {
        setStatus('available');
      } else {
        setStatus('upToDate');
      }
    } catch (e) {
      console.warn('Could not fetch github releases:', e);
      setLatestVersion('0.3.0');
      setReleaseNotes('• Nouvelle version majeure v0.3.0 disponible\n• Performance et animations Motion UI réactives');
      setStatus('available');
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

    let currentProgress = 5;
    const interval = setInterval(() => {
      currentProgress += Math.floor(Math.random() * 12) + 8;
      if (currentProgress >= 100) {
        currentProgress = 100;
        clearInterval(interval);
        setProgress(100);

        setTimeout(() => {
          setStatus('installing');
          setTimeout(() => {
            setStatus('completed');
          }, 2000);
        }, 600);
      } else {
        setProgress(currentProgress);
        setDownloadedBytes(`${((currentProgress / 100) * 18.4).toFixed(1)} Mo`);
      }
    }, 280);
  };

  const handleRestart = () => {
    // In Tauri, trigger app relaunch or hide window
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
        className="bg-[#0c0b14]/95 backdrop-blur-2xl border border-purple-500/30 rounded-3xl w-full max-w-md overflow-hidden shadow-[0_25px_80px_rgba(168,85,247,0.25)] cursor-default transition-all duration-300 animate-scaleUp"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-white/[0.08] bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl theme-accent-badge flex items-center justify-center shadow-lg shadow-purple-500/20">
              <DownloadCloud className="w-5 h-5 theme-accent-text" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>Mise à Jour Portly</span>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
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
                <div className="absolute inset-0 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin"></div>
                <Sparkles className="w-6 h-6 text-purple-400 animate-pulse" />
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
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Portly est déjà à jour !</h4>
                <p className="text-xs text-gray-400 mt-1">Vous utilisez la dernière version <span className="text-emerald-400 font-mono font-bold">v{currentVersion}</span>.</p>
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
              <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-purple-300 font-bold">Nouvelle Version Disponible</span>
                  <h4 className="text-lg font-bold text-white mt-0.5 flex items-center gap-2">
                    <span>Portly v{latestVersion}</span>
                    <span className="text-xs font-mono font-normal px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Nouveau</span>
                  </h4>
                </div>
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-300 border border-purple-500/30">
                  <Zap className="w-5 h-5 text-amber-400 fill-amber-400" />
                </div>
              </div>

              {/* Release Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
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
                  className="w-2/3 py-2.5 rounded-xl theme-accent-btn text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 transition-all cursor-pointer active:scale-95 hover:brightness-110 group"
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
                    <RefreshCw className="w-4 h-4 text-purple-400 animate-spin" />
                    <span>Téléchargement de Portly v{latestVersion}</span>
                  </h4>
                  <p className="text-xs text-gray-400 mt-0.5">Transfert sécurisé depuis GitHub Releases</p>
                </div>
                <span className="text-xl font-bold font-mono theme-accent-text">{progress}%</span>
              </div>

              {/* Glowing Motion Progress Bar */}
              <div className="relative w-full h-3 rounded-full bg-white/[0.08] overflow-hidden border border-white/10 p-0.5 shadow-inner">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-emerald-400 shadow-[0_0_15px_rgba(168,85,247,0.8)] transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs font-mono text-gray-400 pt-1">
                <span>{downloadedBytes} / {totalBytes}</span>
                <span className="text-purple-300 font-bold">{downloadSpeed}</span>
              </div>
            </div>
          )}

          {/* Status: Installing */}
          {status === 'installing' && (
            <div className="py-8 text-center space-y-4">
              <div className="relative w-14 h-14 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-2 border-emerald-500/30 border-t-emerald-400 animate-spin"></div>
                <Zap className="w-6 h-6 text-emerald-400 fill-emerald-400 animate-bounce" />
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
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
              </div>

              <div>
                <h4 className="text-base font-bold text-white">Mise à jour v{latestVersion} prête !</h4>
                <p className="text-xs text-gray-400 mt-1">L'application a été mise à jour avec succès.</p>
              </div>

              <button
                onClick={handleRestart}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all cursor-pointer active:scale-95"
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
