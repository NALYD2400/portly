import React, { useState, useEffect } from 'react';
import { X, Edit3, Save, Palette, Box, Zap, Package, Code, Terminal, Layers, Cpu, Globe, Check } from 'lucide-react';

const COLOR_PRESETS = [
  '#a855f7', // Violet
  '#3b82f6', // Bleu
  '#10b981', // Émeraude
  '#ec4899', // Rose
  '#f59e0b', // Ambre
  '#06b6d4', // Cyan
  '#6366f1', // Indigo
  '#ef4444', // Rouge
];

export default function EditProjectModal({ isOpen, onClose, project, projects, saveProjects }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#a855f7');

  useEffect(() => {
    if (project) {
      setName(project.name || '');
      setColor(project.color || '#a855f7');
    }
  }, [project]);

  if (!isOpen || !project) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const updatedProjects = projects.map((p) => {
      if (p.id === project.id) {
        return {
          ...p,
          name: name.trim() || p.name,
          color: color || p.color,
        };
      }
      return p;
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
        className="glass-panel w-full max-w-md rounded-3xl p-6 border border-white/10 shadow-2xl space-y-5 animate-scaleUp cursor-default bg-[#0d0b1c]"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center border shadow-lg"
              style={{
                backgroundColor: `${color}20`,
                borderColor: `${color}50`,
                color: color,
              }}
            >
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Modifier le Projet</h2>
              <p className="text-xs text-gray-400">Nom et couleur thématique de la carte projet</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Project Name */}
          <div>
            <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5 font-mono">
              Nom du Projet
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white font-mono focus:outline-none theme-accent-border shadow-inner"
            />
          </div>

          {/* Project Color Palette */}
          <div>
            <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2 font-mono flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 theme-accent-text" />
              <span>Couleur de la Puce Projet</span>
            </label>
            <div className="grid grid-cols-4 gap-2.5">
              {COLOR_PRESETS.map((presetHex) => {
                const isSelected = color.toLowerCase() === presetHex.toLowerCase();
                return (
                  <button
                    key={presetHex}
                    type="button"
                    onClick={() => setColor(presetHex)}
                    className={`h-9 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                      isSelected ? 'ring-2 ring-white scale-105 shadow-lg' : 'hover:scale-95 border-white/10'
                    }`}
                    style={{ backgroundColor: presetHex }}
                  >
                    {isSelected && <Check className="w-4 h-4 text-white drop-shadow" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-gray-300 hover:text-white text-xs font-semibold border border-white/10 transition-all cursor-pointer active:scale-95"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl theme-accent-btn text-white font-bold text-xs flex items-center gap-2 shadow-lg transition-all cursor-pointer active:scale-95"
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
