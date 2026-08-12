import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Network, RefreshCw, Skull, ExternalLink, Search, Sparkles } from 'lucide-react';

export default function PortsView({ projects = [] }) {
  const [ports, setPorts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

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
      fetchPorts();
    } catch (e) {
      console.error('Failed to kill process:', e);
    }
  };

  // Map active Portly servers by port
  const portlyServersMap = {};
  projects.forEach((p) => {
    (p.servers || []).forEach((srv) => {
      if (srv.port) {
        portlyServersMap[srv.port] = {
          projectName: p.name,
          projectColor: p.color || '#a855f7',
          serverName: srv.name,
          command: srv.command,
          state: srv.state,
          pid: srv.pid,
        };
      }
    });
  });

  const filteredPorts = search
    ? ports.filter(
        (p) =>
          p.port.toString().includes(search) ||
          p.process_name.toLowerCase().includes(search.toLowerCase()) ||
          p.pid.toString().includes(search) ||
          (portlyServersMap[p.port] &&
            portlyServersMap[p.port].projectName.toLowerCase().includes(search.toLowerCase()))
      )
    : ports;

  return (
    <div className="space-y-5 animate-fadeIn select-none">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>Inspecteur de Ports TCP</span>
            <span className="text-xs font-mono font-normal px-2 py-0.5 rounded-full bg-white/[0.06] text-gray-300">
              {ports.length} port(s) actif(s)
            </span>
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Visualisez tous les ports d'écoute actifs. Les serveurs lancés par Portly sont mis en surbrillance.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher port, PID, projet..."
              className="pl-8 pr-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.1] text-xs text-white placeholder-gray-500 focus:outline-none theme-accent-border w-64 font-mono"
            />
          </div>

          <button
            onClick={fetchPorts}
            disabled={loading}
            className="p-2 rounded-xl theme-accent-badge hover:brightness-125 border theme-accent-border transition-all cursor-pointer flex items-center gap-1.5 text-xs font-medium"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualiser</span>
          </button>
        </div>
      </div>

      {/* Ports Table */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-white/[0.08]">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-white/[0.08] bg-white/[0.02] text-gray-400 font-medium">
              <th className="py-3 px-4">Port</th>
              <th className="py-3 px-4">Processus / App</th>
              <th className="py-3 px-4">PID</th>
              <th className="py-3 px-4">Adresse Locale</th>
              <th className="py-3 px-4">Protocole</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04] font-mono text-gray-300">
            {filteredPorts.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-500 italic">
                  Aucun port d'écoute actif trouvé.
                </td>
              </tr>
            ) : (
              filteredPorts.map((entry) => {
                const portlyMatch = portlyServersMap[entry.port];
                return (
                  <tr
                    key={`${entry.port}-${entry.pid}`}
                    className={`transition-all ${
                      portlyMatch
                        ? 'bg-purple-500/10 hover:bg-purple-500/15 border-l-4 border-l-purple-500'
                        : 'hover:bg-white/[0.03]'
                    }`}
                  >
                    <td className="py-2.5 px-4 font-bold">
                      <span
                        className={portlyMatch ? 'theme-accent-text text-sm' : 'text-purple-400'}
                        style={portlyMatch?.projectColor ? { color: portlyMatch.projectColor } : {}}
                      >
                        :{entry.port}
                      </span>
                    </td>

                    <td className="py-2.5 px-4 font-sans font-medium text-white">
                      <div className="flex items-center gap-2">
                        <span>{entry.process_name}</span>
                        {portlyMatch && (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border shadow-sm"
                            style={{
                              backgroundColor: `${portlyMatch.projectColor}20`,
                              borderColor: `${portlyMatch.projectColor}50`,
                              color: portlyMatch.projectColor,
                            }}
                          >
                            <Sparkles className="w-2.5 h-2.5" />
                            <span>
                              {portlyMatch.projectName} ({portlyMatch.serverName})
                            </span>
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-2.5 px-4 text-gray-400">{entry.pid}</td>
                    <td className="py-2.5 px-4 text-gray-400">{entry.local_address}</td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px]">
                        {entry.protocol}
                      </span>
                    </td>

                    <td className="py-2.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => invoke('open_browser', { url: `http://localhost:${entry.port}` })}
                          className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] text-gray-300 hover:text-white transition-colors cursor-pointer"
                          title="Ouvrir dans le navigateur"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleKillPort(entry.pid)}
                          className="px-2.5 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 transition-colors flex items-center gap-1 font-sans cursor-pointer"
                          title="Tuer le processus"
                        >
                          <Skull className="w-3 h-3 text-red-400" />
                          <span>Tuer (PID {entry.pid})</span>
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
  );
}
