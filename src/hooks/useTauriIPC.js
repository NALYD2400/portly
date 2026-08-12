import { useState, useEffect } from 'react';

const isTauriEnv = () => typeof window !== 'undefined' && (!!window.__TAURI_INTERNALS__ || !!window.__TAURI__);

// Global in-memory log history cache across view navigation & tab switches
const globalLogCache = {};

// Start global continuous log listener at application launch
if (isTauriEnv()) {
  import('@tauri-apps/api/event').then(({ listen }) => {
    listen('server-log-line', (event) => {
      const { server_id, line } = event.payload;
      if (server_id && line !== undefined) {
        if (!globalLogCache[server_id]) {
          globalLogCache[server_id] = [];
        }
        globalLogCache[server_id].push(line);
        if (globalLogCache[server_id].length > 2000) {
          globalLogCache[server_id].shift();
        }
        // Trigger live re-render for active listeners
        window.dispatchEvent(new CustomEvent(`portly-log-${server_id}`));
      }
    });
  }).catch(() => {});
}

export function useProjects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

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

    let unlistenFn = null;
    if (isTauriEnv()) {
      import('@tauri-apps/api/event').then(({ listen }) => {
        listen('server-status-changed', (event) => {
          const { server_id, state, pid } = event.payload;
          setProjects((prev) =>
            prev.map((p) => ({
              ...p,
              servers: (p.servers || []).map((s) =>
                s.id === server_id ? { ...s, state, pid } : s
              ),
            }))
          );
        }).then((fn) => { unlistenFn = fn; });
      }).catch(() => {});
    }

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
    if (!isTauriEnv()) return;
    let unlistenFn = null;
    import('@tauri-apps/api/event').then(({ listen }) => {
      listen('system-metrics', (event) => {
        setMetrics(event.payload);
      }).then((fn) => { unlistenFn = fn; });
    }).catch(() => {});

    return () => {
      if (unlistenFn) unlistenFn();
    };
  }, []);

  return metrics;
}

export function useServerLogs(serverId) {
  const [logs, setLogs] = useState(() => globalLogCache[serverId] ? [...globalLogCache[serverId]] : []);

  useEffect(() => {
    if (!serverId) return;

    const handleNewLog = () => {
      if (globalLogCache[serverId]) {
        setLogs([...globalLogCache[serverId]]);
      }
    };

    handleNewLog();
    window.addEventListener(`portly-log-${serverId}`, handleNewLog);

    return () => {
      window.removeEventListener(`portly-log-${serverId}`, handleNewLog);
    };
  }, [serverId]);

  const clearLogs = () => {
    if (serverId) globalLogCache[serverId] = [];
    setLogs([]);
  };

  return { logs, clearLogs };
}
