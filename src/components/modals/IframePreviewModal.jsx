import React, { useState, useEffect } from 'react';
import {
  X,
  RotateCw,
  ExternalLink,
  Globe,
  Monitor,
  Smartphone,
  Tablet,
  Copy,
  Check,
  Radio,
  AlertTriangle,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { triggerToast } from '../../services/toastBus';
import Modal from '../ui/Modal';
import PreviewFrame from '../ui/PreviewFrame';

export default function IframePreviewModal({ isOpen, onClose, url, title }) {
  const [iframeKey, setIframeKey] = useState(0);
  const [deviceMode, setDeviceMode] = useState('desktop'); // 'desktop' | 'tablet' | 'mobile'
  const [copied, setCopied] = useState(false);
  const [serverOnline, setServerOnline] = useState(true);

  // Vérifier la connectivité du port en arrière-plan
  useEffect(() => {
    if (!isOpen || !url) return;
    try {
      const parsed = new URL(url);
      const port = parseInt(parsed.port, 10);
      if (port) {
        invoke('ping_port_cmd', { port })
          .then((isUp) => setServerOnline(!!isUp))
          .catch(() => setServerOnline(true));
      }
    } catch {
      setServerOnline(true);
    }
  }, [isOpen, url, iframeKey]);

  if (!isOpen || !url) return null;

  const handleRefresh = () => {
    setIframeKey((prev) => prev + 1);
  };

  const handleOpenExternal = () => {
    invoke('open_browser', { url }).catch((e) => {
      triggerToast({ title: '⚠️ Navigateur', message: String(e), type: 'error' });
    });
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    triggerToast({
      title: '📋 URL Copiée',
      message: `${url} copié dans le presse-papier.`,
      type: 'info',
      duration: 2000,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-6xl"
      labelledBy="iframe-preview-title"
      panelClassName="workspace-dialog legacy-preview-dialog"
    >
        {/* Browser Top Shell Navigation Bar */}
        <div className="flex flex-wrap shrink-0 items-center justify-between px-5 py-3.5 bg-[var(--surface-2)] border-b border-[var(--line)] gap-4">
          <div className="flex items-center gap-3 shrink-0 min-w-0">
            <div className="w-8 h-8 rounded-lg theme-accent-btn flex items-center justify-center shrink-0">
              <Monitor className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <span id="iframe-preview-title" className="text-xs font-semibold text-white truncate block max-w-[180px]">
                {title || 'Aperçu Web In-App'}
              </span>
              <span className="text-[10px] text-zinc-400 font-mono flex items-center gap-1.5">
                <Radio
                  className={`w-2.5 h-2.5 ${
                    serverOnline ? 'text-emerald-400 animate-pulse' : 'text-amber-400'
                  }`}
                />
                <span>{serverOnline ? 'Serveur en ligne' : 'Port non détecté'}</span>
              </span>
            </div>
          </div>

          {/* URL Address Bar */}
          <div className="flex-1 max-w-xl flex items-center gap-2 bg-black/40 border border-[var(--line)] rounded-xl px-3.5 py-1.5 text-xs text-zinc-300 font-mono min-w-0">
            <Globe className="w-3.5 h-3.5 theme-accent-text shrink-0" />
            <span className="truncate flex-1 select-all">{url}</span>
            <button
              onClick={handleCopyUrl}
              className="p-1 hover:text-white text-zinc-400 transition-colors cursor-pointer shrink-0"
              title="Copier l'URL"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Responsive Viewport Mode Selectors */}
          <div className="flex items-center gap-1 bg-black/40 border border-[var(--line)] p-1 rounded-lg shrink-0">
            <button
              type="button"
              onClick={() => setDeviceMode('desktop')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                deviceMode === 'desktop' ? 'theme-accent-btn text-white' : 'text-zinc-400 hover:text-white'
              }`}
              title="Vue Desktop (100%)"
            >
              <Monitor className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setDeviceMode('tablet')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                deviceMode === 'tablet' ? 'theme-accent-btn text-white' : 'text-zinc-400 hover:text-white'
              }`}
              title="Vue Tablette (768px)"
            >
              <Tablet className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setDeviceMode('mobile')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                deviceMode === 'mobile' ? 'theme-accent-btn text-white' : 'text-zinc-400 hover:text-white'
              }`}
              title="Vue Mobile (390px)"
            >
              <Smartphone className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleRefresh}
              className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] text-zinc-300 hover:text-white border border-[var(--line)] transition-colors cursor-pointer "
              title="Recharger l'aperçu"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleOpenExternal}
              className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] text-zinc-200 hover:text-white border border-[var(--line)] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer "
              title="Ouvrir dans le navigateur par défaut"
            >
              <ExternalLink className="w-3.5 h-3.5 theme-accent-text" />
              <span>Ouvrir</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-white/[0.04] hover:bg-red-500/20 text-zinc-400 hover:text-red-400 border border-[var(--line)] transition-colors cursor-pointer ml-1 "
              title="Fermer l'aperçu"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Warning if server offline */}
        {!serverOnline && (
          <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                Le serveur local ne semble pas répondre sur ce port. Assurez-vous qu'il est bien démarré.
              </span>
            </div>
            <button
              onClick={handleOpenExternal}
              className="underline font-semibold hover:text-white cursor-pointer"
            >
              Tester dans le navigateur externe →
            </button>
          </div>
        )}

        {/* Web Iframe Viewport Container */}
        <div className="legacy-preview-stage flex-1 min-h-0 bg-[var(--bg-base)] p-4 overflow-hidden relative">
          <PreviewFrame
            frameKey={iframeKey}
            url={url}
            name={title || 'Aperçu web'}
            width={deviceMode === 'mobile' ? 390 : deviceMode === 'tablet' ? 768 : null}
            height={deviceMode === 'mobile' ? 844 : deviceMode === 'tablet' ? 1024 : null}
          />
        </div>
    </Modal>
  );
}
