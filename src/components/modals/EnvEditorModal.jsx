import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { FileText, Save, X, Eye, EyeOff, Check } from 'lucide-react';

export default function EnvEditorModal({ isOpen, onClose, projectRoot }) {
  const [content, setContent] = useState('');
  const [showSecrets, setShowSecrets] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  const isModalOpen = isOpen !== undefined ? isOpen : !!projectRoot;

  useEffect(() => {
    if (isModalOpen && projectRoot) {
      setLoading(true);
      invoke('read_env_file', { projectRoot })
        .then((res) => setContent(res || ''))
        .catch((err) => console.error(err))
        .finally(() => setLoading(false));
    }
  }, [isModalOpen, projectRoot]);

  if (!isModalOpen || !projectRoot) return null;

  const handleSave = async () => {
    try {
      await invoke('save_env_file', { projectRoot, content });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error('Error saving .env file:', e);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 select-none cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel w-full max-w-2xl rounded-2xl p-6 border border-emerald-500/30 shadow-2xl space-y-4 animate-scaleUp cursor-default"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Éditeur .env</h2>
              <p className="text-xs text-gray-400 font-mono">{projectRoot}\.env</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between text-xs">
          <button
            onClick={() => setShowSecrets(!showSecrets)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 transition-colors cursor-pointer"
          >
            {showSecrets ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{showSecrets ? 'Masquer les secrets' : 'Afficher les clés en clair'}</span>
          </button>
          {saved && (
            <span className="flex items-center gap-1 text-emerald-400 text-xs font-medium">
              <Check className="w-3.5 h-3.5" /> Enregistré avec succès !
            </span>
          )}
        </div>

        {/* Editor Area */}
        <div className="relative">
          {loading ? (
            <div className="h-64 flex items-center justify-center text-xs text-gray-500">
              Chargement du fichier .env...
            </div>
          ) : (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="PORT=3000&#10;DATABASE_URL=postgres://..."
              rows={12}
              className="w-full p-4 rounded-xl bg-black/60 border border-white/[0.1] text-xs font-mono text-emerald-300 placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 leading-relaxed resize-none"
            />
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.08]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 text-xs transition-colors cursor-pointer"
          >
            Fermer
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Enregistrer les modifications</span>
          </button>
        </div>
      </div>
    </div>
  );
}
