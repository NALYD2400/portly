import React, { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { Folder, X, Plus, Sparkles, Server } from 'lucide-react';

export default function AddProjectModal({ isOpen, onClose, onAddProject }) {
  const [folderPath, setFolderPath] = useState('');
  const [projectName, setProjectName] = useState('');
  const [stackInfo, setStackInfo] = useState(null);
  const [serverCommand, setServerCommand] = useState('npm run dev');
  const [serverPort, setServerPort] = useState('3000');
  const [color, setColor] = useState('#a855f7');

  if (!isOpen) return null;

  const handleSelectFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Sélectionner le dossier du projet',
      });
      if (selected) {
        setFolderPath(selected);
        const name = selected.split(/[\\/]/).pop() || 'Nouveau Projet';
        setProjectName(name);

        const detected = await invoke('detect_stack_cmd', { path: selected });
        setStackInfo(detected);
        if (detected.default_dev_cmd) {
          setServerCommand(detected.default_dev_cmd);
        }
      }
    } catch (e) {
      console.error('Error selecting directory:', e);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!folderPath || !projectName) return;

    const newProject = {
      id: `prj_${Math.random().toString(36).substr(2, 8)}`,
      name: projectName,
      root: folderPath,
      color,
      icon: stackInfo?.icon || 'package',
      framework: stackInfo?.framework || 'Node.js',
      servers: [
        {
          id: `srv_${Math.random().toString(36).substr(2, 8)}`,
          name: 'dev',
          command: serverCommand,
          port: parseInt(serverPort) || 3000,
          state: 'stopped',
          healthy: false,
          env: {},
        },
      ],
    };

    onAddProject(newProject);
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 select-none cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel w-full max-w-lg rounded-2xl p-6 border theme-accent-border shadow-2xl space-y-5 animate-scaleUp cursor-default"
      >
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg theme-accent-badge flex items-center justify-center">
              <Folder className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Ajouter un Nouveau Projet</h2>
              <p className="text-xs text-gray-400">Importation locale avec détection automatique du stack</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Folder Selector */}
          <div>
            <label className="block font-medium text-gray-300 mb-1.5">Dossier du Projet</label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={folderPath}
                placeholder="Aucun dossier sélectionné..."
                className="flex-1 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.1] text-gray-200 font-mono focus:outline-none"
              />
              <button
                type="button"
                onClick={handleSelectFolder}
                className="px-3.5 py-2 rounded-xl theme-accent-btn text-white font-medium transition-colors cursor-pointer"
              >
                Parcourir
              </button>
            </div>
          </div>

          {/* Project Name & Framework Info */}
          {folderPath && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-gray-300 mb-1.5">Nom du Projet</label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.1] text-white focus:outline-none theme-accent-border"
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-300 mb-1.5">Couleur d'accent</label>
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-full h-9 p-1 rounded-xl bg-white/[0.04] border border-white/[0.1] cursor-pointer"
                  />
                </div>
              </div>

              {stackInfo && (
                <div className="p-3 rounded-xl theme-accent-badge flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 theme-accent-text" />
                    <span>Stack Détecté : <strong>{stackInfo.framework}</strong></span>
                  </div>
                  <span className="font-mono text-[10px] theme-accent-badge px-2 py-0.5 rounded">
                    {stackInfo.package_manager}
                  </span>
                </div>
              )}

              {/* Dev Server Command & Port */}
              <div className="p-3.5 rounded-xl glass-card space-y-3">
                <div className="flex items-center gap-2 font-medium text-gray-200">
                  <Server className="w-4 h-4 theme-accent-text" />
                  <span>Configuration du Serveur Dev</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-[11px] text-gray-400 mb-1">Commande</label>
                    <input
                      type="text"
                      value={serverCommand}
                      onChange={(e) => setServerCommand(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/[0.1] text-white font-mono focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">Port</label>
                    <input
                      type="number"
                      value={serverPort}
                      onChange={(e) => setServerPort(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/[0.1] text-white font-mono focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.08]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={!folderPath || !projectName}
              className="px-4 py-2 rounded-xl theme-accent-btn text-white font-medium transition-colors disabled:opacity-50 cursor-pointer"
            >
              Ajouter le Projet
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
