import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { FileText, Save, X, Eye, EyeOff, Check, AlertCircle } from 'lucide-react';
import Modal from '../ui/Modal';
import ConfirmDialog from '../ui/ConfirmDialog';

export default function EnvEditorModal({ isOpen, onClose, projectRoot }) {
  const [content, setContent] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [showSecrets, setShowSecrets] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const savedTimerRef = useRef(null);

  const isModalOpen = !!projectRoot && isOpen !== false;
  const isDirty = content !== savedContent;

  useEffect(() => {
    if (isModalOpen && projectRoot) {
      setLoading(true);
      setError('');
      setShowSecrets(false);
      invoke('read_env_file', { projectRoot })
        .then((res) => {
          setContent(res || '');
          setSavedContent(res || '');
        })
        .catch((err) => {
          setError(String(err));
          setContent('');
          setSavedContent('');
        })
        .finally(() => setLoading(false));
    }
  }, [isModalOpen, projectRoot]);

  useEffect(
    () => () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    },
    []
  );

  const requestClose = () => {
    if (isDirty) {
      setConfirmDiscard(true);
    } else {
      onClose();
    }
  };

  const handleSave = async () => {
    setError('');
    try {
      await invoke('save_env_file', { projectRoot, content });
      setSavedContent(content);
      setSaved(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(`Échec de la sauvegarde du .env : ${String(e)}`);
    }
  };

  // Vue masquée : les clés sont visibles, les valeurs remplacées par des points
  const maskedLines = content.split('\n').map((line) => {
    const match = line.match(/^(\s*[A-Za-z_][A-Za-z0-9_]*\s*=\s*)(.*)$/);
    if (match) {
      const value = match[2];
      const visible = value.length > 0 ? '•'.repeat(Math.min(value.length, 12)) : '';
      return `${match[1]}${visible}`;
    }
    return line;
  });

  return (
    <>
      <Modal isOpen={isModalOpen} onClose={requestClose} maxWidth="max-w-2xl">
        <div className="p-6 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Éditeur .env</h2>
                <p className="text-xs text-gray-400 font-mono truncate max-w-md">{projectRoot}\.env</p>
              </div>
            </div>
            <button
              type="button"
              onClick={requestClose}
              aria-label="Fermer"
              className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Toolbar */}
          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => setShowSecrets(!showSecrets)}
              aria-pressed={showSecrets}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 transition-colors cursor-pointer"
            >
              {showSecrets ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showSecrets ? 'Masquer les secrets' : 'Afficher les clés en clair'}</span>
            </button>
            <div className="flex items-center gap-3">
              {isDirty && <span className="text-amber-400 font-medium">Modifications non enregistrées</span>}
              {saved && (
                <span className="flex items-center gap-1 text-emerald-400 font-medium">
                  <Check className="w-3.5 h-3.5" /> Enregistré
                </span>
              )}
            </div>
          </div>

          {/* Editor Area */}
          <div className="relative">
            {loading ? (
              <div className="h-64 flex items-center justify-center text-xs text-gray-500">
                Chargement du fichier .env...
              </div>
            ) : showSecrets ? (
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="PORT=3000&#10;DATABASE_URL=postgres://..."
                rows={12}
                spellCheck={false}
                aria-label="Contenu du fichier .env en clair"
                className="w-full p-4 rounded-xl bg-black/60 border border-white/[0.1] text-xs font-mono text-emerald-300 placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 leading-relaxed resize-none"
              />
            ) : (
              <div
                aria-label="Contenu du fichier .env, valeurs masquées"
                className="w-full h-64 p-4 rounded-xl bg-black/60 border border-white/[0.1] text-xs font-mono text-gray-300 leading-relaxed overflow-y-auto select-none"
              >
                {content ? (
                  maskedLines.map((line, idx) => {
                    const isKey = /^\s*[A-Za-z_][A-Za-z0-9_]*\s*=/.test(line);
                    return (
                      <div key={idx} className={isKey ? 'text-gray-200' : 'text-gray-500'}>
                        {line || '\u00A0'}
                      </div>
                    );
                  })
                ) : (
                  <span className="text-gray-600 italic">Fichier .env vide ou inexistant.</span>
                )}
              </div>
            )}
          </div>

          {error && (
            <div role="alert" className="flex items-start gap-2 text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-3.5 py-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="break-words">{error}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.08]">
            <button
              type="button"
              onClick={requestClose}
              className="px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 text-xs transition-colors cursor-pointer"
            >
              Fermer
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!isDirty || loading}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white font-medium text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Enregistrer les modifications</span>
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDiscard}
        title="Modifications non enregistrées"
        message="Vous avez modifié le fichier .env sans enregistrer. Voulez-vous vraiment fermer l'éditeur et perdre ces modifications ?"
        confirmLabel="Fermer sans enregistrer"
        danger
        onConfirm={() => {
          setConfirmDiscard(false);
          onClose();
        }}
        onCancel={() => setConfirmDiscard(false)}
      />
    </>
  );
}
