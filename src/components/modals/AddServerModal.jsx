import React, { useState, useEffect } from 'react';
import { X, Plus, Terminal, Hash, Zap, Sparkles, Server } from 'lucide-react';

export default function AddServerModal({ isOpen, onClose, project, projects, saveProjects }) {
  const [name, setName] = useState('');
  const [command, setCommand] = useState('npm run dev');
  const [port, setPort] = useState('3000');
  const [suggestedScripts, setSuggestedScripts] = useState([]);

  useEffect(() => {
    if (project) {
      setName(`Serveur ${(project.servers || []).length + 1}`);
      setCommand('npm run dev');
      setPort('3000');

      setSuggestedScripts([
        'npm run dev',
        'npm start',
        'node server.js',
        'npx serve -l 3000',
        'python main.py',
        'cargo run',
        'pnpm dev',
        'bun dev',
        'yarn dev',
      ]);
    }
  }, [project, isOpen]);

  if (!isOpen || !project) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !command.trim()) return;

    const newServer = {
      id: `srv_${project.id}_${Date.now()}`,
      name: name.trim(),
      command: command.trim(),
      port: parseInt(port) || 3000,
      state: 'stopped',
      healthy: false,
      env: {},
    };

    const updatedProjects = projects.map((prj) => {
      if (prj.id === project.id) {
        return {
          ...prj,
          servers: [...(prj.servers || []), newServer],
        };
      }
      return prj;
    });

    saveProjects(updatedProjects);
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 select-none cursor-pointer animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#0f0e17]/95 backdrop-blur-2xl border border-white/10 hover:border-purple-500/30 rounded-3xl w-full max-w-lg overflow-hidden shadow-[0_25px_70px_rgba(0,0,0,0.85)] cursor-default transition-all duration-300 animate-scaleUp"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-white/[0.08] bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl theme-accent-badge flex items-center justify-center shadow-md">
              <Server className="w-4.5 h-4.5 theme-accent-text" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Ajouter un Serveur</h3>
              <p className="text-xs text-gray-400">
                Projet : <span className="theme-accent-text font-bold">{project.name}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.1] text-gray-400 hover:text-white transition-all duration-200 hover:rotate-90 hover:scale-110 active:scale-95 cursor-pointer"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Suggested Scripts Chips */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5 font-mono">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Commandes Fréquentes</span>
            </label>

            <div className="flex flex-wrap gap-2 p-3 bg-black/50 border border-white/10 rounded-2xl max-h-36 overflow-y-auto shadow-inner">
              {suggestedScripts.map((scriptCmd) => {
                const isSelected = command.trim() === scriptCmd.trim();
                return (
                  <button
                    key={scriptCmd}
                    type="button"
                    onClick={() => setCommand(scriptCmd)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-semibold flex items-center gap-1.5 transition-all duration-200 cursor-pointer active:scale-95 ${
                      isSelected
                        ? 'theme-accent-btn text-white font-bold border border-white/30 shadow-[0_0_15px_rgba(var(--accent-color-rgb),0.4)] scale-[1.02]'
                        : 'bg-white/[0.04] border border-white/[0.08] text-gray-300 hover:bg-white/[0.1] hover:text-white hover:scale-105'
                    }`}
                  >
                    <Zap className={`w-3.5 h-3.5 ${isSelected ? 'text-amber-300' : 'text-gray-400'}`} />
                    <span>{scriptCmd}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Name & Port */}
          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5 font-mono">
                <Terminal className="w-3.5 h-3.5 theme-accent-text" />
                <span>Nom du Serveur</span>
              </label>
              <div className="relative rounded-xl bg-white/[0.03] border border-white/10 focus-within:border-[var(--accent-color)] focus-within:ring-2 focus-within:ring-purple-500/20 transition-all duration-200 shadow-inner">
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ex: Web Local, API..."
                  className="w-full bg-transparent px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5 font-mono">
                <Hash className="w-3.5 h-3.5 text-cyan-400" />
                <span>Port TCP</span>
              </label>
              <div className="relative rounded-xl bg-white/[0.03] border border-white/10 focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-500/20 transition-all duration-200 shadow-inner">
                <input
                  type="number"
                  required
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  placeholder="3000"
                  className="w-full bg-transparent px-3.5 py-2.5 text-xs text-cyan-300 font-mono font-bold focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Command */}
          <div>
            <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5 font-mono">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Commande de Démarrage</span>
            </label>
            <div className="relative rounded-xl bg-white/[0.03] border border-white/10 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/20 transition-all duration-200 shadow-inner">
              <input
                type="text"
                required
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="ex: npm run dev"
                className="w-full bg-transparent px-3.5 py-2.5 text-xs text-amber-300 font-mono font-bold focus:outline-none"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-white/[0.08]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-gray-300 hover:text-white text-xs font-semibold border border-white/10 transition-all duration-200 cursor-pointer active:scale-95"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl theme-accent-btn text-white text-xs font-bold flex items-center gap-2 shadow-lg transition-all duration-200 cursor-pointer active:scale-95 hover:brightness-110"
            >
              <Plus className="w-4 h-4" />
              <span>Ajouter le Serveur</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
