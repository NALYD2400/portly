import { useEffect, useRef, useState } from 'react';

const isTauriEnv = () => typeof window !== 'undefined' && (!!window.__TAURI_INTERNALS__ || !!window.__TAURI__);

const MAX_LOG_LINES = 2000;
const LOG_BATCH_MS = 100;

// ---------------------------------------------------------------------------
// Cache global de logs : les lignes sont pré-paréisées une seule fois à l'arrivée
// (regex ANSI + détection error/success/info), puis regroupées par lot de ~100ms
// pour éviter un re-render complet par ligne reçue.
// ---------------------------------------------------------------------------

let logSeq = 0;
const globalLogCache = {};
const logListeners = new Map();
const pendingLines = new Map();
let flushScheduled = false;

export function parseLogLine(rawText) {
  if (!rawText) {
    return { clean: '', isError: false, isSuccess: false, isInfo: false };
  }
  // eslint-disable-next-line no-control-regex -- suppression volontaire des codes de couleur ANSI
  const clean = rawText.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '');
  const lower = clean.toLowerCase();

  return {
    clean,
    isError: lower.includes('error') || lower.includes('failed') || lower.includes('uncaught'),
    isSuccess: lower.includes('ready in') || lower.includes('success') || lower.includes('finished'),
    isInfo: lower.includes('vite') || lower.includes('tauri') || lower.includes('running'),
  };
}

function ensureCache(serverId) {
  if (!globalLogCache[serverId]) globalLogCache[serverId] = [];
  return globalLogCache[serverId];
}

function flushLogs() {
  flushScheduled = false;
  for (const [serverId, lines] of pendingLines) {
    pendingLines.delete(serverId);
    const cache = ensureCache(serverId);
    for (const line of lines) {
      const meta = parseLogLine(line);
      cache.push({ id: ++logSeq, raw: line, ...meta });
    }
    if (cache.length > MAX_LOG_LINES) {
      cache.splice(0, cache.length - MAX_LOG_LINES);
    }
    const listeners = logListeners.get(serverId);
    if (listeners) {
      for (const fn of listeners) {
        fn(cache.slice(cache.length - lines.length));
      }
    }
  }
}

if (isTauriEnv()) {
  import('@tauri-apps/api/event')
    .then(({ listen }) => {
      listen('server-log-line', (event) => {
        const { server_id, line } = event.payload;
        if (!server_id || line === undefined) return;

        let batch = pendingLines.get(server_id);
        if (!batch) {
          batch = [];
          pendingLines.set(server_id, batch);
        }
        batch.push(line);

        if (!flushScheduled) {
          flushScheduled = true;
          setTimeout(flushLogs, LOG_BATCH_MS);
        }
      });
    })
    .catch(() => {});
}

export function useServerLogs(serverId) {
  const [logs, setLogs] = useState(() =>
    serverId && globalLogCache[serverId] ? [...globalLogCache[serverId]] : []
  );

  useEffect(() => {
    if (!serverId) {
      setLogs([]);
      return undefined;
    }

    setLogs(globalLogCache[serverId] ? [...globalLogCache[serverId]] : []);

    const onBatch = (batch) => {
      setLogs((prev) => {
        const next = prev.concat(batch);
        if (next.length > MAX_LOG_LINES) {
          next.splice(0, next.length - MAX_LOG_LINES);
        }
        return next;
      });
    };

    let listeners = logListeners.get(serverId);
    if (!listeners) {
      listeners = new Set();
      logListeners.set(serverId, listeners);
    }
    listeners.add(onBatch);

    return () => {
      listeners.delete(onBatch);
    };
  }, [serverId]);

  const clearLogs = () => {
    if (serverId) globalLogCache[serverId] = [];
    setLogs([]);
  };

  return { logs, clearLogs };
}

// ---------------------------------------------------------------------------
// Arrêts volontaires vs crashs : le module garde la liste des serveurs arrêtés
// manuellement pour que l'auto-restart ne s'applique qu'aux vrais crashs.
// ---------------------------------------------------------------------------

const manualStops = new Set();

export function markManualStop(serverId) {
  if (serverId) manualStops.add(serverId);
}

export function useProjects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const projectsRef = useRef(projects);

  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  const fetchProjects = async () => {
    try {
      if (isTauriEnv()) {
        const { invoke } = await import('@tauri-apps/api/core');
        const res = await invoke('get_projects_cmd');
        setProjects(res || []);
      } else {
        const res = await fetch('/api/projects');
        const data = await res.json();
        setProjects(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.warn('Failed to load projects:', e.message);
    } finally {
      setLoading(false);
    }
  };

  const saveProjects = async (updatedProjects) => {
    setProjects(updatedProjects);
    try {
      if (isTauriEnv()) {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('save_projects_cmd', { projects: updatedProjects });
      }
    } catch (e) {
      console.warn('Failed to save projects:', e.message);
    }
  };

  useEffect(() => {
    fetchProjects();

    if (!isTauriEnv()) return undefined;

    // Garde-fou anti crash-loop : max 3 relances par serveur sur 2 minutes.
    const restartTimestamps = new Map();

    const scheduleAutoRestart = (serverId) => {
      const now = Date.now();
      const recent = (restartTimestamps.get(serverId) || []).filter((t) => now - t < 120_000);
      if (recent.length >= 3) {
        restartTimestamps.set(serverId, recent);
        return;
      }
      recent.push(now);
      restartTimestamps.set(serverId, recent);

      setTimeout(async () => {
        let found = null;
        for (const p of projectsRef.current) {
          for (const s of p.servers || []) {
            if (s.id === serverId) {
              found = { project: p, server: s };
              break;
            }
          }
          if (found) break;
        }
        if (!found) return;

        try {
          const { invoke } = await import('@tauri-apps/api/core');
          await invoke('start_server_cmd', {
            serverId,
            cwd: found.project.root,
            command: found.server.command,
            env: found.server.env || {},
          });
          const { triggerToast } = await import('../components/ui/ToastContainer');
          triggerToast({
            title: '🔄 Auto-Restart Anti-Crash',
            message: `${found.server.name} s'est arrêté brutalement et a été relancé automatiquement.`,
            type: 'warning',
          });
        } catch (e) {
          const { triggerToast } = await import('../components/ui/ToastContainer');
          triggerToast({
            title: '⚠️ Auto-Restart Échoué',
            message: `Impossible de relancer ${found.server.name}: ${String(e)}`,
            type: 'error',
          });
        }
      }, 1500);
    };

    let unlistenFn = null;
    import('@tauri-apps/api/event')
      .then(({ listen }) => {
        listen('server-status-changed', (event) => {
          const { server_id, state } = event.payload;

          const wasRunning = projectsRef.current.some((p) =>
            (p.servers || []).some((s) => s.id === server_id && s.state === 'running')
          );

          setProjects((prev) =>
            prev.map((p) => ({
              ...p,
              servers: (p.servers || []).map((s) => (s.id === server_id ? { ...s, state, pid: null } : s)),
            }))
          );

          // Auto-restart anti-crash : seulement si le serveur tournait, n'a pas
          // été arrêté manuellement, et que l'option est activée dans les réglages.
          if (state === 'stopped' && wasRunning && !manualStops.has(server_id)) {
            if (localStorage.getItem('portly_cfg_autorestart') === 'true') {
              scheduleAutoRestart(server_id);
            }
          }
          manualStops.delete(server_id);
        }).then((fn) => {
          unlistenFn = fn;
        });
      })
      .catch(() => {});

    return () => {
      if (unlistenFn) unlistenFn();
    };
  }, []);

  return { projects, setProjects, saveProjects, reload: fetchProjects, loading };
}

export function useSystemMetrics() {
  const [metrics, setMetrics] = useState({
    cpu_usage: 0,
    ram_total_mb: 0,
    ram_used_mb: 0,
    ram_usage_pct: 0,
    disk_total_gb: 0,
    disk_free_gb: 0,
    disk_usage_pct: 0,
    uptime_seconds: 0,
  });

  useEffect(() => {
    if (!isTauriEnv()) return undefined;
    let unlistenFn = null;
    import('@tauri-apps/api/event')
      .then(({ listen }) => {
        listen('system-metrics', (event) => {
          setMetrics(event.payload);
        }).then((fn) => {
          unlistenFn = fn;
        });
      })
      .catch(() => {});

    return () => {
      if (unlistenFn) unlistenFn();
    };
  }, []);

  return metrics;
}
