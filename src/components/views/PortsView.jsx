import React, { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Network,
  RefreshCw,
  Skull,
  ExternalLink,
  Search,
  Sparkles,
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

  return (
    <div className="space-y-4 animate-fadeIn select-none pb-12 max-w-6xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <span>Inspecteur de Ports</span>
            <span className="text-xs font-mono font-normal px-2.5 py-0.5 rounded-full bg-white/[0.06] text-gray-300 border border-white/10">
              {ports.length} actif{ports.length > 1 ? 's' : ''}
            </span>
            {sprintPortsCount > 0 && (
              <span className="text-xs font-mono font-medium px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>{sprintPortsCount} Sprint</span>
              </span>
            )}
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Surveillez les processus locaux et ports TCP en écoute en temps réel.
          </p>
        </div>

        {/* Barre d'outils et filtres */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Segmented Control */}
          <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.08] p-0.5 rounded-xl text-xs">
            <button
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                filterType === 'all'
                  ? 'bg-white/[0.12] text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Tous ({ports.length})
            </button>

            <button
              onClick={() => setFilterType('sprint')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                filterType === 'sprint'
                  ? 'bg-white/[0.12] text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3 h-3 theme-accent-text" />
              <span>Sprint ({sprintPortsCount})</span>
            </button>

            <button
              onClick={() => setFilterType('system')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                filterType === 'system'
                  ? 'bg-white/[0.12] text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Système ({systemPortsCount})
            </button>
          </div>

          {/* Search Filter */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrer port, PID, app..."
              className="pl-9 pr-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none theme-accent-border w-44 sm:w-52 shadow-inner transition-all font-mono"
            />
          </div>

          {/* Refresh Button */}
          <button
            onClick={handleManualRefresh}
            className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 hover:text-white border border-white/[0.08] transition-all cursor-pointer active:scale-95 shrink-0"
            title="Actualiser les ports"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${showSpinner ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {fetchError && (
        <div role="alert" className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-xs text-red-300 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span className="break-words">Erreur de scan des ports : {fetchError}</span>
        </div>
      )}

      {/* Ports Table */}
      <div className="rounded-2xl border border-white/[0.08] overflow-hidden bg-[#0d0e17]/90 backdrop-blur-md shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.02] text-gray-400 font-mono text-[11px] uppercase tracking-wider">
                <th scope="col" className="py-2.5 px-4">Port</th>
                <th scope="col" className="py-2.5 px-4">Processus / Application</th>
                <th scope="col" className="py-2.5 px-4">PID</th>
                <th scope="col" className="py-2.5 px-4">Adresse Locale</th>
                <th scope="col" className="py-2.5 px-4">Protocole</th>
                <th scope="col" className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04] font-mono text-gray-300">
              {filteredPorts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500 font-sans italic space-y-1">
                    <div className="text-sm font-semibold text-gray-400">Aucun port correspondant</div>
                    <div className="text-xs text-gray-500">
                      {search || filterType !== 'all'
                        ? 'Essayez de réinitialiser vos critères de recherche.'
                        : 'Aucun port TCP en écoute détecté sur le système.'}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPorts.map((entry) => {
                  const sprintMatch = sprintServersMap[entry.port];
                  return (
                    <tr
                      key={`${entry.port}-${entry.pid}`}
                      className={`transition-colors duration-150 ${
                        sprintMatch
                          ? 'bg-purple-500/[0.04] hover:bg-purple-500/[0.08]'
                          : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      {/* Port */}
                      <td className="py-2.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-md text-xs font-mono font-semibold ${
                            sprintMatch
                              ? 'theme-accent-badge font-bold'
                              : 'bg-white/[0.04] text-gray-300 border border-white/[0.06]'
                          }`}
                        >
                          :{entry.port}
                        </span>
                      </td>

                      {/* Process & Project Name */}
                      <td className="py-2.5 px-4 font-sans font-medium text-white">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{entry.process_name}</span>
                          {sprintMatch && (
                            <span
                              className="inline-flex items-center gap-1 text-[10px] font-mono font-medium px-2 py-0.5 rounded-md border"
                              style={{
                                backgroundColor: `${sprintMatch.projectColor}15`,
                                borderColor: `${sprintMatch.projectColor}40`,
                                color: sprintMatch.projectColor,
                              }}
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: sprintMatch.projectColor }}
                              />
                              <span>
                                {sprintMatch.projectName} ({sprintMatch.serverName})
                              </span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* PID */}
                      <td className="py-2.5 px-4 text-gray-400 font-mono text-xs">
                        {entry.pid ?? '—'}
                      </td>

                      {/* Local Address */}
                      <td className="py-2.5 px-4 text-gray-400 font-mono text-xs">
                        {entry.local_address}
                      </td>

                      {/* Protocol */}
                      <td className="py-2.5 px-4">
                        <span className="px-1.5 py-0.5 rounded bg-white/[0.03] text-gray-400 border border-white/[0.06] text-[10px] font-mono">
                          {entry.protocol}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Ouvrir dans le navigateur */}
                          <button
                            onClick={() => invoke('open_browser', { url: `http://localhost:${entry.port}` })}
                            className="p-1.5 rounded-lg hover:bg-white/[0.08] text-gray-400 hover:text-white transition-colors cursor-pointer"
                            title={`Ouvrir http://localhost:${entry.port}`}
                            aria-label="Ouvrir dans le navigateur"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>

                          {/* Tuer le processus */}
                          <button
                            onClick={() =>
                              setConfirmKill({
                                pid: entry.pid,
                                processName: entry.process_name,
                                port: entry.port,
                                isSprint: !!sprintMatch,
                              })
                            }
                            className="p-1.5 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-rose-500/15 transition-colors cursor-pointer"
                            title={`Arrêter ${entry.process_name} (PID ${entry.pid})`}
                            aria-label="Arrêter le processus"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

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
