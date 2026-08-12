import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Network, RefreshCw, Skull, ExternalLink, Search, Sparkles, Radio, Server, ShieldAlert, CheckCircle2 } from 'lucide-react';

import { triggerToast } from '../ui/ToastContainer';

export default function PortsView({ projects = [] }) {
  const [ports, setPorts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');

  const fetchPorts = async () => {
    setLoading(true);
    try {
      const res = await invoke('get_ports_cmd');
      setPorts(res || []);
    } catch (e) {
      console.error('Failed to fetch active ports:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPorts();
    const interval = setInterval(fetchPorts, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleKillPort = async (pid) => {
    try {
      await invoke('kill_port_cmd', { pid });
      triggerToast({
        title: '☠️ Processus Terminé',
        message: `Le processus PID ${pid} a été libéré.`,
        type: 'warning',
      });
      fetchPorts();
    } catch (e) {
      console.error('Failed to kill process:', e);
      triggerToast({
        title: '⚠️ Échec de la Fermeture',
        message: String(e),
        type: 'error',
      });
    }
  };

  // Map active Portly servers by port
  const portlyServersMap = {};
  projects.forEach((p) => {
    (p.servers || []).forEach((srv) => {
      if (srv.port) {
        portlyServersMap[srv.port] = {
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

  const portlyPortsCount = ports.filter((p) => !!portlyServersMap[p.port]).length;

  const filteredPorts = ports.filter((p) => {
    const isPortly = !!portlyServersMap[p.port];

    if (filterType === 'portly' && !isPortly) return false;
    if (filterType === 'system' && isPortly) return false;

    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.port.toString().includes(q) ||
      p.process_name.toLowerCase().includes(q) ||
      p.pid.toString().includes(q) ||
      (isPortly && portlyServersMap[p.port].projectName.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 animate-fadeIn select-none pb-8">
      {/* Header Banner */}
      <div className="glass-panel p-6 rounded-3xl border border-white/10 shadow-2xl bg-gradient-to-r from-[#0d0b1a] via-[#130f2c] to-[#0d0b1a] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Network className="w-6 h-6 theme-accent-text" />
              <span>Inspecteur de Ports TCP & Processus</span>
            </h1>

            <span className="text-[10px] font-bold font-mono px-2.5 py-0.5 rounded-full theme-accent-badge flex items-center gap-1">
              <Radio className="w-3 h-3 theme-accent-text animate-pulse" />
              Live Sync 3s
            </span>
          </div>

          <p className="text-xs text-gray-400 mt-1.5">
            Moniteur des ports d'écoute actifs du système. Les serveurs gérés par Portly sont automatiquement identifiés.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Search Bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Port, PID, app, projet..."
              className="pl-9 pr-3 py-2 rounded-2xl bg-white/[0.04] border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none theme-accent-border w-60 font-mono shadow-inner"
            />
          </div>

          <button
            onClick={fetchPorts}
            disabled={loading}
            className="px-4 py-2 rounded-2xl theme-accent-btn text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg active:scale-95 hover:brightness-110"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualiser</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 p-1.5 rounded-2xl glass-panel border border-white/10 bg-black/40">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterType === 'all'
                ? 'theme-accent-btn text-white shadow-md'
                : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            Tous ({ports.length})
          </button>

          <button
            onClick={() => setFilterType('portly')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              filterType === 'portly'
                ? 'theme-accent-btn text-white shadow-md'
                : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 theme-accent-text" />
            <span>Serveurs Portly ({portlyPortsCount})</span>
          </button>

          <button
            onClick={() => setFilterType('system')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterType === 'system'
                ? 'theme-accent-btn text-white shadow-md'
                : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            Autres Processus ({ports.length - portlyPortsCount})
          </button>
        </div>

        <div className="text-xs text-gray-400 font-mono">
          Affichage: <span className="text-white font-bold">{filteredPorts.length}</span> port(s)
        </div>
      </div>

      {/* Ports Table */}
      <div className="glass-panel rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-[#0c0a18]/90">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02] text-gray-400 font-mono text-[11px] uppercase tracking-wider">
                <th className="py-3.5 px-5">Port</th>
                <th className="py-3.5 px-5">Processus / Application</th>
                <th className="py-3.5 px-5">PID</th>
                <th className="py-3.5 px-5">Adresse Locale</th>
                <th className="py-3.5 px-5">Protocole</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04] font-mono text-gray-300">
              {filteredPorts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500 font-sans italic space-y-2">
                    <div className="text-sm font-semibold text-gray-400">Aucun port d'écoute actif trouvé</div>
                    <div className="text-xs text-gray-500">Essayez de réinitialiser vos critères de recherche.</div>
                  </td>
                </tr>
              ) : (
                filteredPorts.map((entry) => {
                  const portlyMatch = portlyServersMap[entry.port];
                  return (
                    <tr
                      key={`${entry.port}-${entry.pid}`}
                      className={`transition-all duration-200 ${
                        portlyMatch
                          ? 'border-l-4 theme-accent-border font-bold'
                          : 'hover:bg-white/[0.03]'
                      }`}
                      style={
                        portlyMatch
                          ? { backgroundColor: 'rgba(var(--accent-color-rgb), 0.12)' }
                          : {}
                      }
                    >
                      {/* Port Badge */}
                      <td className="py-3 px-5 font-bold">
                        <span
                          className={`text-sm font-mono tracking-tight px-2.5 py-1 rounded-xl ${
                            portlyMatch
                              ? 'theme-accent-badge font-extrabold shadow-md'
                              : 'bg-white/[0.05] text-gray-300 border border-white/10'
                          }`}
                        >
                          :{entry.port}
                        </span>
                      </td>

                      {/* Process & Project Info */}
                      <td className="py-3 px-5 font-sans font-medium text-white">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="font-semibold">{entry.process_name}</span>
                          {portlyMatch && (
                            <span
                              className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full border shadow-md"
                              style={{
                                backgroundColor: `${portlyMatch.projectColor}20`,
                                borderColor: `${portlyMatch.projectColor}50`,
                                color: portlyMatch.projectColor,
                              }}
                            >
                              <Sparkles className="w-3 h-3" />
                              <span>
                                {portlyMatch.projectName} ({portlyMatch.serverName})
                              </span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* PID */}
                      <td className="py-3 px-5">
                        <span className="text-xs font-mono text-gray-400 bg-white/[0.04] border border-white/10 px-2 py-0.5 rounded-lg">
                          {entry.pid}
                        </span>
                      </td>

                      {/* Local Address */}
                      <td className="py-3 px-5 text-gray-400 font-mono text-xs">
                        {entry.local_address}
                      </td>

                      {/* Protocol */}
                      <td className="py-3 px-5">
                        <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold">
                          {entry.protocol}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => invoke('open_browser', { url: `http://localhost:${entry.port}` })}
                            className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.1] text-gray-300 hover:text-white border border-white/[0.08] transition-all cursor-pointer active:scale-95"
                            title="Ouvrir dans le navigateur"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleKillPort(entry.pid)}
                            className="px-3.5 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold text-xs flex items-center gap-1.5 border border-red-500/40 shadow-lg shadow-red-500/10 transition-all cursor-pointer active:scale-95"
                            title="Tuer le processus"
                          >
                            <Skull className="w-3.5 h-3.5 fill-red-400 text-red-400" />
                            <span>Tuer ({entry.pid})</span>
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
    </div>
  );
}
