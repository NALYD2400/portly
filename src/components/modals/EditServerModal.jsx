import React, { useState, useEffect } from 'react';
import { X, Edit3, Save, Terminal, Shield, Zap, Sparkles, Check, Hash } from 'lucide-react';

export default function EditServerModal({ isOpen, onClose, target, editTarget, projects, saveProjects }) {
  const activeTarget = target || editTarget;
  const isModalOpen = isOpen !== undefined ? isOpen : !!activeTarget;

  const [command, setCommand] = useState('');
  const [port, setPort] = useState('3000');
  const [name, setName] = useState('');
  const [detectedScripts, setDetectedScripts] = useState([]);

  useEffect(() => {
    if (activeTarget && activeTarget.server) {
      setName(activeTarget.server.name || 'dev');
      setCommand(activeTarget.server.command || '');
      setPort(activeTarget.server.port ? String(activeTarget.server.port) : '3000');

      if (activeTarget.project && activeTarget.project.root) {
        const scripts = ['npm run dev', 'npm start', 'node server.js', 'npx serve', 'python main.py', 'cargo run', 'pnpm dev', 'bun dev', 'yarn dev'];
        setDetectedScripts(scripts);
      }
    }
  }, [activeTarget]);

  if (!isModalOpen || !activeTarget || !activeTarget.server) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const updatedProjects = projects.map((prj) => {
      const targetPrjId = activeTarget.projectId || activeTarget.project?.id;
      if (prj.id === targetPrjId) {
        return {
          ...prj,
          servers: (prj.servers || []).map((srv) => {
            if (srv.id === activeTarget.server.id) {
              return {
                ...srv,
                name: name.trim() || srv.name,
                command: command.trim() || srv.command,
                port: parseInt(port) || srv.port,
              };
            }
            return srv;
          }),
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
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-white/[0.08] bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl theme-accent-badge flex items-center justify-center shadow-md">
              <Edit3 className="w-4.5 h-4.5 theme-accent-text" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Modifier le Serveur <span className="theme-accent-text font-mono">({activeTarget.server.name})</span>
              </h3>
              <p className="text-xs text-gray-400">Ajustez la commande de démarrage et le port TCP</p>
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
          {/* Suggested / Detected Commands Chips */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5 font-mono">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Commandes Suggérées / Détectées</span>
            </label>

            <div className="flex flex-wrap gap-2 p-3 bg-black/50 border border-white/10 rounded-2xl max-h-36 overflow-y-auto shadow-inner">
              {detectedScripts.map((scriptCmd) => {
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
                    {isSelected && <Check className="w-3.5 h-3.5 text-white ml-0.5" />}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-gray-400">
              Cliquez sur un badge ci-dessus pour insérer automatiquement la commande de démarrage.
            </p>
          </div>

          {/* Name & Port Grid */}
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
                  className="w-full bg-transparent px-3.5 py-2.5 text-xs text-cyan-300 font-mono font-bold focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Default Launch Command */}
          <div>
            <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5 font-mono">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Commande de Démarrage par Défaut</span>
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
              <Save className="w-4 h-4" />
              <span>Enregistrer</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
