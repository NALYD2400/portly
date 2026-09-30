import React, { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  RefreshCw,
  ExternalLink,
  Search,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { triggerToast } from '../../services/toastBus';
import ConfirmDialog from '../ui/ConfirmDialog';

const POLL_INTERVAL_MS = 3000;

export default function PortsView({ projects = [] }) {
  const [ports, setPorts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [fetchError, setFetchError] = useState('');
  const [confirmKill, setConfirmKill] = useState(null); // { pid, processName, port, isSprint }
  const manualRefreshRef = useRef(false);

  const fetchPorts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await invoke('get_ports_cmd');
      setPorts(res || []);
      setFetchError('');
    } catch (e) {
      setFetchError(String(e));
    } finally {
      setLoading(false);
      manualRefreshRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchPorts();

    let interval = setInterval(fetchPorts, POLL_INTERVAL_MS);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (!interval) interval = setInterval(fetchPorts, POLL_INTERVAL_MS);
        fetchPorts();
      } else if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (interval) clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchPorts]);

  const handleManualRefresh = () => {
    manualRefreshRef.current = true;
    fetchPorts();
  };

  const executeKill = async () => {
    if (!confirmKill) return;
    const { pid, processName } = confirmKill;
    setConfirmKill(null);
    try {
      await invoke('kill_port_cmd', { pid });
      triggerToast({
        title: '⏹ Processus Terminé',
        message: `${processName} (PID ${pid}) a été arrêté avec succès.`,
        type: 'warning',
      });
      fetchPorts();
    } catch (e) {
      triggerToast({
        title: '⚠️ Échec de la Fermeture',
        message: String(e),
        type: 'error',
      });
    }
  };

  // Mapper les serveurs Sprint actifs par port
  const sprintServersMap = {};
  projects.forEach((p) => {
    (p.servers || []).forEach((srv) => {
      if (srv.port) {
        sprintServersMap[srv.port] = {
          projectName: p.name,
          projectColor: p.color || 'var(--accent-color)',
          serverName: srv.name,
          command: srv.command,
          state: srv.state,
          pid: srv.pid,
        };
      }
    });
  });

  const sprintPortsCount = ports.filter((p) => !!sprintServersMap[p.port]).length;
  const systemPortsCount = ports.length - sprintPortsCount;

  const filteredPorts = ports.filter((p) => {
    const isSprint = !!sprintServersMap[p.port];

    if (filterType === 'sprint' && !isSprint) return false;
    if (filterType === 'system' && isSprint) return false;

    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.port.toString().includes(q) ||
      p.process_name.toLowerCase().includes(q) ||
      String(p.pid ?? '').includes(q) ||
      (isSprint && sprintServersMap[p.port].projectName.toLowerCase().includes(q))
    );
  });

  const showSpinner = loading && manualRefreshRef.current;

  const filters = [
    { id: 'all', label: 'Tous', count: ports.length },
    { id: 'sprint', label: 'Mes projets', count: sprintPortsCount },
    { id: 'system', label: 'Autres', count: systemPortsCount },
  ];

  return (
    <div className="animate-fadeIn select-none pb-12 max-w-4xl mx-auto">
      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-[22px] font-semibold text-zinc-50 tracking-tight">Ports</h1>
          <p className="text-[13px] text-zinc-500 mt-1">
            Ce qui est ouvert sur votre ordinateur. Utile quand un port est déjà pris.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher"
              className="pl-8 pr-3 h-8 rounded-md bg-transparent hover:bg-white/[0.04] border border-transparent text-xs text-white placeholder-zinc-600 focus:bg-white/[0.04] w-36 focus:w-52 transition-all"
            />
          </div>
          <button
            onClick={handleManualRefresh}
            className="w-8 h-8 flex items-center justify-center rounded-md text-zinc-500 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
            title="Actualiser"
            aria-label="Actualiser"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${showSpinner ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 mb-3">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilterType(f.id)}
            className={`h-7 px-2.5 rounded-md text-xs transition-colors cursor-pointer ${
              filterType === f.id ? 'bg-white/[0.08] text-white' : 'text-zinc-500 hover:text-zinc-200'
            }`}
          >
            {f.label} <span className="text-zinc-600 ml-0.5">{f.count}</span>
          </button>
        ))}
      </div>

      {fetchError && (
        <div role="alert" className="mb-3 p-3 rounded-lg bg-red-500/10 text-xs text-red-300 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span className="break-words">Impossible de lire les ports : {fetchError}</span>
        </div>
      )}

      {filteredPorts.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-sm text-zinc-300">Aucun port trouvé</p>
          <p className="text-xs text-zinc-500 mt-1">
            {search || filterType !== 'all' ? 'Essayez un autre filtre.' : 'Aucun port en écoute pour le moment.'}
          </p>
        </div>
      ) : (
        <div>
          {filteredPorts.map((entry) => {
            const sprintMatch = sprintServersMap[entry.port];
            return (
              <div
                key={`${entry.port}-${entry.pid}`}
                className="group flex items-center justify-between gap-4 h-11 px-3 -mx-3 rounded-lg hover:bg-white/[0.03] transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="stat-value text-[13px] text-zinc-100 w-14">:{entry.port}</span>
                  <span className="text-[13px] text-zinc-300 truncate">{entry.process_name}</span>
                  {sprintMatch && (
                    <span className="flex items-center gap-1.5 text-xs text-zinc-500 truncate">
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: sprintMatch.projectColor }}
                      />
                      {sprintMatch.projectName}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-xs font-mono text-zinc-600 mr-2" title="Identifiant du processus">
                    PID {entry.pid ?? '—'}
                  </span>
                  <button
                    onClick={() => invoke('open_browser', { url: `http://localhost:${entry.port}` })}
                    className="w-7 h-7 flex items-center justify-center rounded-md text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                    title={`Ouvrir http://localhost:${entry.port}`}
                    aria-label="Ouvrir dans le navigateur"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() =>
                      setConfirmKill({
                        pid: entry.pid,
                        processName: entry.process_name,
                        port: entry.port,
                        isSprint: !!sprintMatch,
                      })
                    }
                    className="w-7 h-7 flex items-center justify-center rounded-md text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    title={`Arrêter ${entry.process_name}`}
                    aria-label="Arrêter le processus"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmKill}
        title={confirmKill?.isSprint ? 'Arrêter ce serveur Sprint ?' : 'Terminer ce processus système ?'}
        message={
          confirmKill?.isSprint
            ? `Vous allez forcer l'arrêt de « ${confirmKill?.processName} » (PID ${confirmKill?.pid}) qui écoute sur le port ${confirmKill?.port} et qui appartient à un de vos projets Sprint.`
            : `Attention : « ${confirmKill?.processName} » (PID ${confirmKill?.pid}) sur le port ${confirmKill?.port} n'appartient PAS à Sprint. Forcer son arrêt peut déstabiliser l'application ou le service qui l'utilise.`
        }
        confirmLabel={`Arrêter le processus ${confirmKill ? `(${confirmKill.pid})` : ''}`.trim()}
        danger
        onConfirm={executeKill}
        onCancel={() => setConfirmKill(null)}
      />
    </div>
  );
}
