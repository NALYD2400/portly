import React, { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { RefreshCw, ExternalLink, Search, ShieldAlert, XCircle } from 'lucide-react';
import { triggerToast } from '../../services/toastBus';
import ConfirmDialog from '../ui/ConfirmDialog';
import PageHeader from '../ui/PageHeader';

const POLL_INTERVAL_MS = 3000;

export default function PortsView({ projects = [] }) {
  const [ports, setPorts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [fetchError, setFetchError] = useState('');
  const [confirmKill, setConfirmKill] = useState(null); // { pid, processName, port, isSprint }
  const manualRefreshRef = useRef(false);
  const fetchingRef = useRef(false);
  const [sort, setSort] = useState({ key: 'port', ascending: true });

  const fetchPorts = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
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
      fetchingRef.current = false;
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
      if (srv.port && srv.state === 'running') {
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

  const filteredPorts = ports
    .filter((p) => {
      const isSprint = !!sprintServersMap[p.port];

      if (filterType === 'sprint' && !isSprint) return false;
      if (filterType === 'system' && isSprint) return false;

      if (!search) return true;
      const q = search.toLowerCase();
      return (
        p.port.toString().includes(q) ||
        (p.process_name || '').toLowerCase().includes(q) ||
        (p.local_address || '').toLowerCase().includes(q) ||
        String(p.pid ?? '').includes(q) ||
        (isSprint && sprintServersMap[p.port].projectName.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      const comparison =
        sort.key === 'port' || sort.key === 'pid'
          ? Number(a[sort.key]) - Number(b[sort.key])
          : String(a[sort.key] || '').localeCompare(String(b[sort.key] || ''), 'fr');
      return sort.ascending ? comparison : -comparison;
    });

  const showSpinner = loading && manualRefreshRef.current;

  const filters = [
    { id: 'all', label: 'Tous', count: ports.length },
    { id: 'sprint', label: 'Mes projets', count: sprintPortsCount },
    { id: 'system', label: 'Autres', count: systemPortsCount },
  ];

  const changeSort = (key) =>
    setSort((previous) => ({
      key,
      ascending: previous.key === key ? !previous.ascending : true,
    }));
  return (
    <div className="page workspace-page animate-fadeIn">
      <PageHeader
        title="Ports"
        lead={ports.length + ' ports en écoute · Actualisation toutes les 3 secondes'}
        actions={
          <button className="btn" onClick={handleManualRefresh} disabled={loading}>
            <RefreshCw size={14} className={showSpinner ? 'animate-spin' : ''} />
            Actualiser
          </button>
        }
      />
      <div className="flex items-center justify-between gap-4 flex-wrap mb-5">
        <div className="segmented-control" aria-label="Filtrer les ports">
          {filters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setFilterType(filter.id)}
              aria-pressed={filterType === filter.id}
            >
              {filter.label}
              <span className="text-zinc-400">{filter.count}</span>
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={14} className="text-zinc-400 absolute left-2.5 top-2.5" />
          <input
            className="control-input !pl-8 w-60"
            aria-label="Filtrer les ports"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Port, projet, processus ou PID"
          />
        </div>
      </div>
      {fetchError && (
        <div role="alert" className="text-xs text-rose-300 flex items-start gap-2 py-3">
          <ShieldAlert size={16} />
          <span>Impossible de lire les ports : {fetchError}</span>
        </div>
      )}
      {filteredPorts.length === 0 ? (
        <div className="empty-state">
          <p className="text-zinc-100">{loading ? 'Recherche des ports…' : 'Aucun port trouvé'}</p>
          <p className="text-xs mt-2">
            {search || filterType !== 'all'
              ? 'Essayez une autre recherche ou affichez tous les ports.'
              : 'Les connexions actives apparaîtront ici.'}
          </p>
          {(search || filterType !== 'all') && (
            <button
              className="btn mt-4"
              onClick={() => {
                setSearch('');
                setFilterType('all');
              }}
            >
              Afficher tous les ports
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="ports-table">
            <thead>
              <tr>
                {[
                  ['port', 'Port'],
                  ['process_name', 'Processus / projet'],
                  ['pid', 'PID'],
                  ['local_address', 'Adresse locale'],
                ].map(([key, label]) => (
                  <th
                    key={key}
                    aria-sort={
                      sort.key === key ? (sort.ascending ? 'ascending' : 'descending') : 'none'
                    }
                  >
                    <button className="cursor-pointer" onClick={() => changeSort(key)}>
                      {label}
                      {sort.key === key ? (sort.ascending ? ' ↑' : ' ↓') : ''}
                    </button>
                  </th>
                ))}
                <th>Protocole</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPorts.map((entry) => {
                const match = sprintServersMap[entry.port];
                return (
                  <tr key={entry.protocol + '-' + entry.local_address + '-' + entry.pid}>
                    <td className="font-mono text-zinc-100">:{entry.port}</td>
                    <td className="port-process">
                      <span className="text-zinc-200">{entry.process_name || 'Inconnu'}</span>
                      {match && (
                        <div className="flex items-center gap-1.5 text-xs text-zinc-400 mt-1">
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: match.projectColor }}
                          />
                          {match.projectName}
                        </div>
                      )}
                    </td>
                    <td className="font-mono text-xs text-zinc-400">{entry.pid ?? '—'}</td>
                    <td className="font-mono text-xs text-zinc-400 whitespace-nowrap">
                      {entry.local_address}
                    </td>
                    <td className="text-xs text-zinc-400">{entry.protocol || 'TCP'}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <button
                          className="icon-button"
                          title="Ouvrir dans le navigateur"
                          aria-label={'Ouvrir le port ' + entry.port}
                          onClick={() =>
                            invoke('open_browser', {
                              url: 'http://localhost:' + entry.port,
                            }).catch((reason) =>
                              triggerToast({
                                title: 'Navigateur',
                                message: String(reason),
                                type: 'error',
                              }),
                            )
                          }
                        >
                          <ExternalLink size={14} />
                        </button>
                        <button
                          className="icon-button hover:text-rose-400"
                          disabled={!entry.pid}
                          title={'Arrêter ' + entry.process_name}
                          aria-label={
                            'Arrêter ' + entry.process_name + ' sur le port ' + entry.port
                          }
                          onClick={() =>
                            setConfirmKill({
                              pid: entry.pid,
                              processName: entry.process_name,
                              port: entry.port,
                              isSprint: !!match,
                            })
                          }
                        >
                          <XCircle size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-zinc-500 mt-4">
        {filteredPorts.length} résultats · Les ports de vos projets sont identifiés quand leurs
        serveurs tournent.
      </p>
      <ConfirmDialog
        open={!!confirmKill}
        title={
          confirmKill?.isSprint ? 'Arrêter ce serveur Sprint ?' : 'Terminer ce processus système ?'
        }
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
