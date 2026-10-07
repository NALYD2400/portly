import React, { useState, useEffect, useMemo, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  RotateCw,
  ExternalLink,
  Monitor,
  Tablet,
  Smartphone,
  Copy,
  Check,
  Terminal,
  Columns,
  Play,
  Square,
  QrCode,
  X,
} from 'lucide-react';
import { triggerToast } from '../../services/toastBus';
import { useServerLogs, markManualStop, unmarkManualStop } from '../../hooks/useTauriIPC';
import PageHeader from '../ui/PageHeader';
import PreviewFrame from '../ui/PreviewFrame';
import Modal from '../ui/Modal';

const DEVICES = [
  ['desktop', 'Ordinateur', Monitor],
  ['tablet', 'Tablette', Tablet],
  ['mobile', 'Mobile', Smartphone],
  ['dual', 'Comparer', Columns],
  ['custom', 'Libre', null],
];
export default function BrowserView({ projects = [], initialServerId, initialUrl, onSelectTab }) {
  const servers = useMemo(
    () =>
      projects.flatMap((project) =>
        (project.servers || [])
          .filter((server) => server.port > 0)
          .map((server) => ({
            ...server,
            projectName: project.name,
            projectRoot: project.root,
            url: server.url || `http://localhost:${server.port}`,
          })),
      ),
    [projects],
  );
  const [serverId, setServerId] = useState(
    initialServerId || servers.find((server) => server.state === 'running')?.id || servers[0]?.id,
  );
  const server = servers.find((item) => item.id === serverId) || servers[0];
  const [url, setUrl] = useState(initialUrl || server?.url || '');
  const [address, setAddress] = useState(url);
  const [frameKey, setFrameKey] = useState(0);
  const [mode, setMode] = useState('desktop');
  const [width, setWidth] = useState(1280);
  const [height, setHeight] = useState(800);
  const [fit, setFit] = useState(true);
  const [online, setOnline] = useState(null);
  const [starting, setStarting] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [localIp, setLocalIp] = useState('127.0.0.1');
  const [showQr, setShowQr] = useState(false);
  const timers = useRef({});
  const { logs, clearLogs } = useServerLogs(server?.id);
  useEffect(
    () => () => {
      Object.values(timers.current).forEach(clearTimeout);
    },
    [],
  );
  useEffect(() => {
    invoke('get_local_ip_cmd')
      .then(setLocalIp)
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (initialServerId) setServerId(initialServerId);
    if (initialUrl) {
      setUrl(initialUrl);
      setAddress(initialUrl);
    }
  }, [initialServerId, initialUrl]);
  useEffect(() => {
    setOnline(null);
    if (!server?.port) return undefined;
    let disposed = false;
    let checking = false;
    const check = async () => {
      if (disposed || checking || document.hidden) return;
      checking = true;
      try {
        const up = await invoke('ping_port_cmd', { port: server.port });
        if (!disposed) setOnline(!!up);
      } catch {
        if (!disposed) setOnline(false);
      } finally {
        checking = false;
      }
    };
    check();
    const timer = setInterval(check, 2500);
    document.addEventListener('visibilitychange', check);
    return () => {
      disposed = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, [server?.id, server?.port]);
  useEffect(() => {
    if (online && starting) {
      setStarting(false);
      clearTimeout(timers.current.start);
      setFrameKey((key) => key + 1);
    }
  }, [online, starting]);
  const selectServer = (id) => {
    const selected = servers.find((item) => item.id === id);
    if (!selected) return;
    clearTimeout(timers.current.start);
    setStarting(false);
    setServerId(id);
    setUrl(selected.url);
    setAddress(selected.url);
    setError('');
    setFrameKey((key) => key + 1);
  };
  const navigate = (event) => {
    event.preventDefault();
    try {
      const text = address.trim();
      const target = text.startsWith('/')
        ? new URL(text, server?.url || url)
        : new URL(/^[a-z][a-z\d+.-]*:/i.test(text) ? text : 'http://' + text);
      if (!['http:', 'https:'].includes(target.protocol))
        throw new Error('Utilisez une adresse http ou https.');
      setUrl(target.href);
      setAddress(target.href);
      setError('');
      setFrameKey((key) => key + 1);
    } catch {
      setError('Adresse invalide. Utilisez une URL http ou https, ou un chemin comme /contact.');
    }
  };
  const copy = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      clearTimeout(timers.current.copy);
      timers.current.copy = setTimeout(() => setCopied(false), 2000);
    } catch (reason) {
      triggerToast({
        title: 'Copie impossible',
        message: String(reason),
        type: 'error',
      });
    }
  };
  const openExternal = () =>
    invoke('open_browser', { url }).catch((reason) =>
      triggerToast({
        title: 'Navigateur',
        message: String(reason),
        type: 'error',
      }),
    );
  const start = async () => {
    if (!server) return;
    setStarting(true);
    clearTimeout(timers.current.start);
    timers.current.start = setTimeout(() => {
      setStarting(false);
      triggerToast({
        title: 'Serveur indisponible',
        message: 'Le port ne répond pas encore. Consultez les logs.',
        type: 'warning',
      });
    }, 30000);
    try {
      await invoke('start_server_cmd', {
        serverId: server.id,
        cwd: server.projectRoot,
        command: server.command,
        env: server.env || {},
      });
    } catch (reason) {
      clearTimeout(timers.current.start);
      setStarting(false);
      triggerToast({
        title: 'Lancement impossible',
        message: String(reason),
        type: 'error',
      });
    }
  };
  const stop = async () => {
    markManualStop(server.id);
    try {
      await invoke('stop_server_cmd', { serverId: server.id });
      setOnline(false);
    } catch (reason) {
      unmarkManualStop(server.id);
      triggerToast({
        title: 'Arrêt impossible',
        message: String(reason),
        type: 'error',
      });
    }
  };
  let localTarget = false;
  try {
    localTarget = !!server && new URL(url).origin === new URL(server.url).origin;
  } catch {}
  const canPreview = !!url && (!localTarget || online === true);
  const offline = (
    <div className="empty-state h-full flex flex-col justify-center items-center bg-[var(--bg-base)]">
      <p className="text-sm text-zinc-100">
        {server
          ? online === null
            ? 'Vérification du serveur…'
            : server.projectName + ' est hors ligne'
          : 'Aucun serveur web configuré'}
      </p>
      <p className="text-xs text-zinc-400 mt-2">
        {server
          ? 'Lancez le serveur pour afficher votre site.'
          : 'Ajoutez un serveur avec un port dans vos projets.'}
      </p>
      {server ? (
        <button
          className="btn mt-4 theme-accent-btn"
          disabled={starting || online === null}
          onClick={start}
        >
          <Play size={14} />
          {starting ? 'Démarrage…' : 'Lancer le serveur'}
        </button>
      ) : (
        <button className="btn mt-4" onClick={() => onSelectTab('projects')}>
          Aller aux projets
        </button>
      )}
    </div>
  );
  const lanUrl = server?.port ? `http://${localIp}:${server.port}` : url;
  const dimensions =
    mode === 'mobile'
      ? '390 × 844'
      : mode === 'tablet'
        ? '768 × 1024'
        : mode === 'custom'
          ? width + ' × ' + height
          : mode === 'dual'
            ? '1280 × 800 + 390 × 844'
            : 'Largeur disponible';
  const frame = (name, frameWidth, frameHeight) => (
    <PreviewFrame
      name={name}
      url={url}
      frameKey={frameKey + '-' + name}
      width={frameWidth}
      height={frameHeight}
      fit={fit}
    >
      {canPreview ? null : offline}
    </PreviewFrame>
  );
  return (
    <div className="page preview-page animate-fadeIn">
      <PageHeader
        title="Aperçu web"
        actions={
          <>
            <button
              className="icon-button"
              aria-label="Tester sur téléphone"
              title="Tester sur téléphone"
              disabled={!server || !online}
              onClick={() => setShowQr(true)}
            >
              <QrCode size={16} />
            </button>
            <button
              className="quiet-button"
              aria-pressed={showLogs}
              onClick={() => setShowLogs(!showLogs)}
            >
              <Terminal size={14} />
              Logs
            </button>
          </>
        }
      />
      <div className="preview-toolbar">
        <select
          className="control-input max-w-60"
          aria-label="Serveur à prévisualiser"
          value={server?.id || ''}
          onChange={(event) => selectServer(event.target.value)}
        >
          {servers.length ? (
            servers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.projectName} · {item.name} :{item.port}
              </option>
            ))
          ) : (
            <option value="">Aucun serveur</option>
          )}
        </select>
        <form className="preview-address" onSubmit={navigate}>
          <button
            type="button"
            className="icon-button"
            title="Recharger"
            aria-label="Recharger l’aperçu"
            disabled={!url}
            onClick={() => setFrameKey((key) => key + 1)}
          >
            <RotateCw size={14} />
          </button>
          <input
            aria-label="Adresse de l’aperçu"
            className="control-input font-mono"
            placeholder="http://localhost:3000"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
          />
          <button type="submit" className="quiet-button">
            Ouvrir
          </button>
          <button
            type="button"
            disabled={!url}
            className="icon-button"
            title="Copier l’URL"
            aria-label="Copier l’URL"
            onClick={() => copy(url)}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
          <button
            type="button"
            className="icon-button"
            title="Ouvrir dans le navigateur si le site bloque l’intégration"
            aria-label="Ouvrir dans le navigateur"
            disabled={!url}
            onClick={openExternal}
          >
            <ExternalLink size={14} />
          </button>
        </form>
      </div>
      <div className="preview-toolbar preview-device-toolbar">
        <div className="segmented-control" aria-label="Format de l’aperçu">
          {DEVICES.map(([id, label, Icon]) => (
            <button key={id} aria-pressed={mode === id} onClick={() => setMode(id)}>
              {Icon && <Icon size={14} />}
              {label}
            </button>
          ))}
        </div>
        {mode === 'custom' && (
          <>
            <input
              aria-label="Largeur de l’aperçu"
              type="number"
              min="240"
              max="3840"
              value={width}
              className="control-input w-20"
              onChange={(event) => setWidth(event.target.value)}
              onBlur={() => setWidth(Math.min(3840, Math.max(240, Number(width) || 1280)))}
            />
            <span className="text-zinc-400">×</span>
            <input
              aria-label="Hauteur de l’aperçu"
              type="number"
              min="240"
              max="2160"
              value={height}
              className="control-input w-20"
              onChange={(event) => setHeight(event.target.value)}
              onBlur={() => setHeight(Math.min(2160, Math.max(240, Number(height) || 800)))}
            />
          </>
        )}
        <select
          className="control-input"
          aria-label="Zoom de l’aperçu"
          value={fit ? 'fit' : 'actual'}
          onChange={(event) => setFit(event.target.value === 'fit')}
        >
          <option value="fit">Ajuster</option>
          <option value="actual">100 %</option>
        </select>
        <span className="preview-status" role="status" title={dimensions}>
          {server
            ? online === null
              ? 'Vérification…'
              : online
                ? 'Serveur en ligne'
                : 'Serveur arrêté'
            : 'Aucun serveur'}
        </span>
        {server && (
          <button
            className="quiet-button ml-auto"
            disabled={starting || online === null}
            onClick={online ? stop : start}
          >
            {online ? <Square size={13} /> : <Play size={14} />}
            {online ? 'Arrêter' : starting ? 'Démarrage…' : 'Lancer'}
          </button>
        )}
      </div>
      {error && (
        <p className="text-xs text-rose-400 mt-3" role="alert">
          {error}
        </p>
      )}
      <div
        className={
          'preview-stage' + (mode !== 'desktop' ? ' device' : '') + (mode === 'dual' ? ' dual' : '')
        }
      >
        {mode === 'dual' ? (
          <>
            {frame('Ordinateur', 1280, 800)}
            {frame('Mobile', 390, 844)}
          </>
        ) : mode === 'mobile' ? (
          frame('Mobile', 390, 844)
        ) : mode === 'tablet' ? (
          frame('Tablette', 768, 1024)
        ) : mode === 'custom' ? (
          frame(
            'Format libre',
            Math.min(3840, Math.max(240, Number(width) || 1280)),
            Math.min(2160, Math.max(240, Number(height) || 800)),
          )
        ) : (
          frame('Ordinateur', null, null)
        )}
      </div>
      {showLogs && (
        <div className="preview-logs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-zinc-400">{server?.name || 'Logs'}</span>
            <button className="quiet-button" onClick={clearLogs}>
              Effacer
            </button>
          </div>
          {logs.length ? (
            logs.slice(-100).map((entry) => (
              <div key={entry.id} className={entry.isError ? 'text-rose-300' : 'text-zinc-300'}>
                {entry.clean}
              </div>
            ))
          ) : (
            <p className="text-zinc-400">Les logs de ce serveur apparaîtront ici.</p>
          )}
        </div>
      )}
      <Modal
        isOpen={showQr}
        onClose={() => setShowQr(false)}
        labelledBy="qr-preview-title"
        maxWidth="max-w-sm"
      >
        <div className="p-6 text-center">
          <div className="flex justify-between">
            <h2 id="qr-preview-title" className="text-sm">
              Tester sur téléphone
            </h2>
            <button className="icon-button" aria-label="Fermer" onClick={() => setShowQr(false)}>
              <X size={14} />
            </button>
          </div>
          <p className="text-xs text-zinc-400 my-3">
            Sur le même Wi-Fi, avec un serveur accessible sur le réseau local.
          </p>
          <img
            className="w-48 h-48 mx-auto"
            alt="QR code de l’aperçu"
            src={
              'https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=12&data=' +
              encodeURIComponent(lanUrl)
            }
          />
          <button className="quiet-button mt-3 font-mono" onClick={() => copy(lanUrl)}>
            {lanUrl}
          </button>
        </div>
      </Modal>
    </div>
  );
}
