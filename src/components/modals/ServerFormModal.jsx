import React, { useEffect, useState } from 'react';
import { Plus, Edit3, Save, Terminal, Shield, Zap, Sparkles, Check, Hash, X } from 'lucide-react';
import Modal from '../ui/Modal';

const SUGGESTED_SCRIPTS = [
  'npm run dev',
  'npm start',
  'node server.js',
  'npx serve -l 3000',
  'python main.py',
  'cargo run',
  'pnpm dev',
  'bun dev',
  'yarn dev',
];

const isValidPort = (value) => {
  const n = parseInt(value, 10);
  return Number.isInteger(n) && n >= 1 && n <= 65535;
};

/**
 * Formulaire unifié d'ajout et d'édition de serveur
 * (remplace AddServerModal + EditServerModal, ~90% dupliqués).
 */
export default function ServerFormModal({
  mode = 'add',
  isOpen,
  onClose,
  project,
  server,
  projects,
  saveProjects,
}) {
  const isEdit = mode === 'edit';
  const [name, setName] = useState('');
  const [command, setCommand] = useState('npm run dev');
  const [port, setPort] = useState('3000');
  const [ramLimit, setRamLimit] = useState('500');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    if (isEdit && server) {
      setName(server.name || 'dev');
      setCommand(server.command || '');
      setPort(server.port ? String(server.port) : '3000');
      setRamLimit(server.ramLimit ? String(server.ramLimit) : '500');
    } else {
      setName(`Serveur ${((project && project.servers) || []).length + 1}`);
      setCommand('npm run dev');
      setPort('3000');
      setRamLimit('500');
    }
  }, [isOpen, isEdit, server, project]);

  if (!isOpen || !project) return null;

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!name.trim() || !command.trim()) {
      setError('Le nom et la commande de démarrage sont obligatoires.');
      return;
    }
    if (!isValidPort(port)) {
      setError('Le port TCP doit être un nombre entre 1 et 65535.');
      return;
    }
    // Limite RAM vide = Auto-Guard désactivé pour ce serveur
    const ramText = ramLimit.trim();
    let ram;
    if (ramText === '') {
      ram = undefined;
    } else {
      ram = parseInt(ramText, 10);
      if (Number.isNaN(ram) || ram < 0) {
        setError('La limite RAM doit être un nombre positif de mégaoctets.');
        return;
      }
    }

    const portNum = parseInt(port, 10);

    if (isEdit && server) {
      const updatedProjects = projects.map((prj) => {
        if (prj.id !== project.id) return prj;
        return {
          ...prj,
          servers: (prj.servers || []).map((srv) =>
            srv.id === server.id
              ? {
                  ...srv,
                  name: name.trim(),
                  command: command.trim(),
                  port: portNum,
                  ramLimit: ram,
                }
              : srv
          ),
        };
      });
      saveProjects(updatedProjects);
    } else {
      const newServer = {
        id: `srv_${project.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: name.trim(),
        command: command.trim(),
        port: portNum,
        ramLimit: ram,
        state: 'stopped',
        healthy: false,
        env: {},
      };
      const updatedProjects = projects.map((prj) =>
        prj.id === project.id
          ? { ...prj, servers: [...(prj.servers || []), newServer] }
          : prj
      );
      saveProjects(updatedProjects);
    }

    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-white/[0.02]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl theme-accent-badge flex items-center justify-center shadow-md">
            {isEdit ? (
              <Edit3 className="w-4 h-4 theme-accent-text" />
            ) : (
              <Plus className="w-4 h-4 theme-accent-text" />
            )}
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">
              {isEdit ? `Modifier ${server ? server.name : 'le Serveur'}` : 'Ajouter un Serveur'}
            </h3>
            <p className="text-xs text-gray-400">
              Projet : <span className="theme-accent-text font-bold">{project.name}</span>
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="p-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.1] text-gray-400 hover:text-white transition-all duration-200 hover:rotate-90 hover:scale-110 active:scale-95 cursor-pointer"
        >
          <X className="w-4 h-4" />
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
            {SUGGESTED_SCRIPTS.map((scriptCmd) => {
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
            Cliquez sur un badge pour insérer automatiquement la commande de démarrage.
          </p>
        </div>

        {/* Name & Port */}
        <div className="grid grid-cols-2 gap-3.5">
          <div>
            <label htmlFor="srv-name" className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5 font-mono">
              <Terminal className="w-3.5 h-3.5 theme-accent-text" />
              <span>Nom du Serveur</span>
            </label>
            <div className="rounded-xl bg-white/[0.03] border border-white/10 focus-within:border-[var(--accent-color)] focus-within:ring-2 focus-within:ring-[rgba(var(--accent-color-rgb),0.2)] transition-all duration-200 shadow-inner">
              <input
                id="srv-name"
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
            <label htmlFor="srv-port" className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5 font-mono">
              <Hash className="w-3.5 h-3.5 text-cyan-400" />
              <span>Port TCP</span>
            </label>
            <div className="rounded-xl bg-white/[0.03] border border-white/10 focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-500/20 transition-all duration-200 shadow-inner">
              <input
                id="srv-port"
                type="number"
                required
                min="1"
                max="65535"
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
          <label htmlFor="srv-cmd" className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5 font-mono">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Commande de Démarrage</span>
          </label>
          <div className="rounded-xl bg-white/[0.03] border border-white/10 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/20 transition-all duration-200 shadow-inner">
            <input
              id="srv-cmd"
              type="text"
              required
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="ex: npm run dev"
              className="w-full bg-transparent px-3.5 py-2.5 text-xs text-amber-300 font-mono font-bold focus:outline-none"
            />
          </div>
        </div>

        {/* RAM Auto-Guard Limit */}
        <div>
          <label htmlFor="srv-ram" className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5 font-mono">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>Auto-Guard : Limite RAM Max (MB)</span>
          </label>
          <div className="rounded-xl bg-white/[0.03] border border-white/10 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all duration-200 shadow-inner">
            <input
              id="srv-ram"
              type="number"
              min="0"
              value={ramLimit}
              onChange={(e) => setRamLimit(e.target.value)}
              placeholder="ex: 500"
              className="w-full bg-transparent px-3.5 py-2.5 text-xs text-emerald-300 font-mono font-bold focus:outline-none"
            />
          </div>
          <p className="text-[10px] text-gray-400 mt-1 font-sans">
            Laissez vide pour désactiver. Sinon, si ce serveur dépasse cette limite de RAM, Portly le redémarre automatiquement (30 s minimum entre deux relances).
          </p>
        </div>

        {error && (
          <div role="alert" className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-3.5 py-2.5">
            {error}
          </div>
        )}

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
            {isEdit ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span>{isEdit ? 'Enregistrer' : 'Ajouter le Serveur'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
