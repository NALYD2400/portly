import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Settings, Palette, Zap, Monitor, Shield, Check, Sparkles, RefreshCw, Hash, ChevronRight, Download, Upload, Bot, Copy, Pipette, Keyboard } from 'lucide-react';
import ToggleSwitch from '../ui/ToggleSwitch';
import { triggerToast } from '../ui/ToastContainer';

import pkg from '../../../package.json';

function hexToRgbStr(hex) {
  if (!hex || !hex.startsWith('#')) return '168, 85, 247';
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const num = parseInt(c, 16);
  if (isNaN(num)) return '168, 85, 247';
  return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
}

function isValidHex(hex) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex);
}

function ShortcutRecorder({ value, onChange }) {
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    if (!isRecording) return undefined;

    const handleKeyDown = (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Escape') {
        setIsRecording(false);
        return;
      }
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;

      const parts = [];
      if (e.ctrlKey) parts.push('Ctrl');
      if (e.altKey) parts.push('Alt');
      if (e.shiftKey) parts.push('Shift');

      // Un raccourci global OS nécessite au moins un modificateur
      if (!e.ctrlKey && !e.altKey) {
        parts.unshift('Ctrl');
      }

      let keyName = e.key.toUpperCase();
      if (keyName === ' ') keyName = 'Space';

      parts.push(keyName);
      onChange(parts.join('+'));
      setIsRecording(false);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isRecording, onChange]);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setIsRecording(!isRecording)}
        className={`px-4 py-2 rounded-xl border text-xs font-mono font-bold transition-all duration-200 cursor-pointer shadow-inner min-w-[150px] text-center ${
          isRecording
            ? 'theme-accent-active animate-pulse border-white/30'
            : 'bg-white/[0.05] hover:bg-white/[0.1] theme-accent-text border-white/10'
        }`}
      >
        {isRecording ? '⌨️ Touches... (Esc pour annuler)' : value || 'Cliquer pour enregistrer'}
      </button>
    </div>
  );
}

// Généré une seule fois au chargement du module — chemins génériques, plus de
// dossier personnel en dur, version synchronisée avec package.json.
const SKILL_MARKDOWN = `---
name: portly
description: Automatically adds, registers, and manages codebases/projects in Portly (the high-performance Rust-powered developer process supervisor). Use when the user types /portly or asks to register, track, configure, or inspect projects in Portly.
---

# Portly v${pkg.version} Project Supervisor Skill

This skill registers, configures, and manages active codebase projects in **Portly** (\`%APPDATA%\\portly\\projects.json\`).

## System Architecture

- **GitHub Repository**: [NALYD2400/portly](https://github.com/NALYD2400/portly)
- **Config Storage**: \`%APPDATA%\\portly\\projects.json\`
- **Native Rust Engine**: Process manager with asynchronous stdout/stderr log streaming and real-time CPU/RAM telemetry polling (every 2s).
- **Auto-Stop Child Processes on Exit**: On app exit or tray quit, Portly terminates all spawned dev servers (taskkill /F /T) to prevent orphaned processes.
- **Auto-Restart & RAM Guard**: Servers that crash (or exceed their configured RAM limit) are automatically restarted with a cooldown.
- **In-App Auto-Updater**: Connects to GitHub Releases with signature-domain validation and an animated progress modal.

---

## Workflow: Registering a Project (/portly)

1. **Detect Stack & Dev Commands**:
   - **Root Path**: Workspace root directory.
   - **Project Name**: Folder basename or \`name\` field in \`package.json\` / \`Cargo.toml\`.
   - **Framework Detection Rules**:
     - **Next.js / Vite / React / Vue / Svelte**: \`npm run dev\` (Port 3000 or 5173)
     - **Tauri / Rust**: \`npm run tauri dev\` or \`cargo run\`
     - **Express / Node**: \`node server.js\`
     - **Python (FastAPI/Flask/Django)**: \`python main.py\` or \`uvicorn main:app --reload\` (Port 8000)
     - **Go**: \`go run .\` (Port 8080)

2. **Update projects.json**:
   - Read \`%APPDATA%\\portly\\projects.json\`.
   - If \`root == current_workspace_root\` exists, update dev commands if needed.
   - If missing, append a new project configuration with servers.
   - Save formatted JSON back.

3. **User Confirmation**:
   - Return a concise markdown summary confirming project registration, detected stack, assigned port, and dev command.`;

export default function SettingsView({ projects = [], onOpenUpdateModal, reloadProjects }) {
  const [activeSubTab, setActiveSubTab] = useState('appearance');

  // Theme Accent
  const [hexColor, setHexColor] = useState(() => localStorage.getItem('portly_custom_hex') || '#a855f7');
  const [hexDraft, setHexDraft] = useState(hexColor);
  const [hexError, setHexError] = useState(false);

  // Toggles State
  const [canvasBg, setCanvasBg] = useState(() => localStorage.getItem('portly_cfg_canvas') !== 'false');
  const [autoRestart, setAutoRestart] = useState(() => localStorage.getItem('portly_cfg_autorestart') === 'true');
  const [hideStoppedServers, setHideStoppedServers] = useState(() => localStorage.getItem('portly_cfg_hidestopped') !== 'false');
  const [cleanAnsiLogs, setCleanAnsiLogs] = useState(() => localStorage.getItem('portly_cfg_cleanansi') !== 'false');
  const [minimizeToTray, setMinimizeToTray] = useState(() => localStorage.getItem('portly_cfg_minimizetotray') !== 'false');
  const [notifWindows, setNotifWindows] = useState(() => localStorage.getItem('portly_cfg_notif_windows') !== 'false');
  const [notifApp, setNotifApp] = useState(() => localStorage.getItem('portly_cfg_notif_app') !== 'false');
  const [autoStart, setAutoStart] = useState(false);
  const [globalShortcut, setGlobalShortcut] = useState(
    () => localStorage.getItem('portly_cfg_shortcut') || 'Ctrl+Alt+P'
  );

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [copiedSkill, setCopiedSkill] = useState(false);
  const savedTimerRef = useRef(null);
  const copiedTimerRef = useRef(null);

  useEffect(
    () => () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    },
    []
  );

  // Applique la couleur sauvegardée silencieusement au montage (pas de toast parasite)
  useEffect(() => {
    applyAccentColor(hexColor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showAutoSaved = () => {
    setSavedSuccess(true);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSavedSuccess(false), 2000);
  };

  const applyAccentColor = (color) => {
    document.documentElement.style.setProperty('--accent-color', color);
    document.documentElement.style.setProperty('--accent-color-rgb', hexToRgbStr(color));
  };

  const commitHexColor = (candidate) => {
    const trimmed = candidate.trim();
    if (isValidHex(trimmed)) {
      setHexError(false);
      setHexColor(trimmed);
      setHexDraft(trimmed);
      localStorage.setItem('portly_custom_hex', trimmed);
      applyAccentColor(trimmed);
      showAutoSaved();
    } else {
      setHexError(true);
    }
  };

  const handleUpdateShortcut = (value) => {
    // N'enregistre le raccourci que si l'OS l'a réellement accepté
    invoke('register_global_shortcut_cmd', { shortcut: value })
      .then(() => {
        setGlobalShortcut(value);
        localStorage.setItem('portly_cfg_shortcut', value);
        showAutoSaved();
      })
      .catch((e) => {
        triggerToast({
          title: '⚠️ Raccourci Refusé',
          message: String(e),
          type: 'error',
        });
      });
  };

  const handleDownloadSkill = () => {
    const blob = new Blob([SKILL_MARKDOWN], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'SKILL.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopySkill = () => {
    navigator.clipboard.writeText(SKILL_MARKDOWN);
    setCopiedSkill(true);
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => setCopiedSkill(false), 2000);
  };

  const handleExportConfig = async () => {
    try {
      const currentProjects = await invoke('get_projects_cmd');
      const dataStr = JSON.stringify(currentProjects || [], null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `portly_config_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      triggerToast({
        title: '📦 Export Réussi',
        message: 'Sauvegarde de vos projets téléchargée.',
        type: 'success',
      });
    } catch (e) {
      triggerToast({
        title: '⚠️ Échec de l\'Export',
        message: String(e),
        type: 'error',
      });
    }
  };

  const handleImportConfig = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        if (!Array.isArray(importedData)) {
          triggerToast({
            title: '⚠️ Format Invalide',
            message: 'Le fichier de sauvegarde ne contient pas une liste de projets.',
            type: 'error',
          });
          return;
        }
        await invoke('save_projects_cmd', { projects: importedData });
        if (reloadProjects) {
          await reloadProjects();
        }
        triggerToast({
          title: '✅ Configuration Importée',
          message: `${importedData.length} projet(s) restauré(s) avec succès.`,
          type: 'success',
        });
      } catch {
        triggerToast({
          title: '⚠️ Échec de l\'Import',
          message: 'Impossible de lire le fichier JSON fourni.',
          type: 'error',
        });
      }
    };
    reader.readAsText(file);
  };

  const presetColors = [
    { name: 'Violet Cyber', hex: '#a855f7' },
    { name: 'Cyan Néon', hex: '#06b6d4' },
    { name: 'Émeraude Dev', hex: '#10b981' },
    { name: 'Rose Magenta', hex: '#ec4899' },
    { name: 'Or Solaire', hex: '#f59e0b' },
    { name: 'Bleu Électrique', hex: '#3b82f6' },
  ];

  // Tous les toggles acceptent un flag `silent` (utilisé par le reset global
  // pour éviter 8 toasts d'un coup).
  const makeToggle = (setter, storageKey, transform = (v) => v, after) => (val, silent = false) => {
    setter(val);
    localStorage.setItem(storageKey, val ? 'true' : 'false');
    if (after) after(val);
    if (!silent) showAutoSaved();
  };

  const toggleCanvasBg = makeToggle(setCanvasBg, 'portly_cfg_canvas', undefined, () =>
    window.dispatchEvent(new Event('portly_canvas_toggle'))
  );
  const toggleAutoRestart = makeToggle(setAutoRestart, 'portly_cfg_autorestart');
  const toggleHideStoppedServers = makeToggle(setHideStoppedServers, 'portly_cfg_hidestopped');
  const toggleCleanAnsiLogs = makeToggle(setCleanAnsiLogs, 'portly_cfg_cleanansi');
  const toggleMinimizeToTray = makeToggle(setMinimizeToTray, 'portly_cfg_minimizetotray');
  const toggleNotifWindows = makeToggle(setNotifWindows, 'portly_cfg_notif_windows');
  const toggleNotifApp = makeToggle(setNotifApp, 'portly_cfg_notif_app');

  useEffect(() => {
    invoke('is_autostart_cmd')
      .then((enabled) => setAutoStart(!!enabled))
      .catch(() => {});
  }, []);

  const toggleAutoStart = async (val) => {
    setAutoStart(val);
    localStorage.setItem('portly_cfg_autostart', val ? 'true' : 'false');
    try {
      await invoke('set_autostart_cmd', { enable: val });
      showAutoSaved();
    } catch (e) {
      triggerToast({
        title: '⚠️ Échec du Réglage OS',
        message: `Impossible de modifier le démarrage automatique: ${String(e)}`,
        type: 'error',
      });
    }
  };

  const handleResetDefaults = () => {
    commitHexColor('#a855f7');
    toggleCanvasBg(true, true);
    toggleAutoRestart(false, true);
    toggleHideStoppedServers(true, true);
    toggleCleanAnsiLogs(true, true);
    toggleMinimizeToTray(true, true);
    toggleNotifWindows(true, true);
    toggleNotifApp(true, true);
    toggleAutoStart(false);
    showAutoSaved();
  };

  const menuNav = [
    { id: 'appearance', label: 'Apparence & Couleurs (#HEX)', icon: Palette, desc: 'Thèmes, variables CSS et canvas' },
    { id: 'process', label: 'Serveurs & Auto-Restart', icon: Zap, desc: 'Gestion des crashs et logs' },
    { id: 'system', label: 'Système & Fenêtres', icon: Monitor, desc: 'Bouton X, notifications et autorun' },
    { id: 'backup', label: 'Sauvegarde & Diagnostic', icon: Shield, desc: 'Backup JSON et stockage' },
  ];

  const SettingRow = ({ title, description, checked, onToggle, inverted = false, children }) => (
    <div
      onClick={() => onToggle(!checked)}
      className="glass-card p-4 rounded-xl flex items-center justify-between cursor-pointer select-none"
    >
      <div>
        <div className="text-xs font-semibold text-white">{title}</div>
        <div className="text-[11px] text-gray-400 mt-0.5">{description}</div>
      </div>
      {children || (
        <ToggleSwitch
          checked={inverted ? !checked : checked}
          onChange={(val) => onToggle(inverted ? !val : val)}
        />
      )}
    </div>
  );

  return (
    <div className="w-full space-y-6 animate-fadeIn select-none pb-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white/[0.05] theme-accent-text border theme-accent-border flex items-center justify-center shadow-lg">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <span>Paramètres Portly</span>
              <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full theme-accent-badge border border-white/10">
                v{pkg.version}
              </span>
              {savedSuccess && (
                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 font-sans animate-fadeIn">
                  <Check className="w-3.5 h-3.5" /> Enregistré
                </span>
              )}
            </h1>
            <p className="text-xs text-gray-400">
              Personnalisation avancée de l'interface, des processus et des préférences système.
            </p>
          </div>
        </div>
      </div>

      {/* Sub-Pages Settings Layout */}
      <div className="flex flex-col md:flex-row gap-6 min-h-[480px] w-full">
        {/* Settings Navigation Sidebar */}
        <div className="w-full md:w-64 lg:w-72 glass-panel p-2.5 rounded-2xl border border-white/[0.08] bg-black/40 space-y-1.5 flex-shrink-0">
          <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 font-mono">
            Catégories
          </div>

          {menuNav.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-all cursor-pointer border ${
                  isActive
                    ? 'theme-accent-active border-white/20 shadow-md font-bold'
                    : 'border-transparent text-gray-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'theme-accent-text' : 'text-gray-400'}`} />
                  <div>
                    <div className="text-xs font-semibold text-white">{tab.label}</div>
                    <div className="text-[10px] text-gray-400 font-normal truncate max-w-[160px]">{tab.desc}</div>
                  </div>
                </div>
                <ChevronRight className={`w-3.5 h-3.5 ${isActive ? 'theme-accent-text' : 'opacity-0'}`} />
              </button>
            );
          })}
        </div>

        {/* Dedicated Settings Sub-Page Content */}
        <div className="flex-1 w-full glass-panel p-6 rounded-2xl border border-white/[0.08] bg-black/40">
          {/* Sub-Page 1: Apparence & Couleurs */}
          {activeSubTab === 'appearance' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="border-b border-white/[0.08] pb-4">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Palette className="w-5 h-5 theme-accent-text" />
                  <span>Apparence & Couleurs (#HEX)</span>
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  Définissez la couleur thématique d'accent de l'application et les effets visuels de fond.
                </p>
              </div>

              <div className="space-y-5">
                <div>
                  <label htmlFor="hex-input" className="text-xs font-medium text-gray-300 block mb-2">
                    Code Couleur d'Accentuation (#HEX) :
                  </label>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    {/* Custom Glowing Swatch Color Picker */}
                    <div className="relative group shrink-0">
                      <div
                        className="w-10 h-10 rounded-xl border-2 border-white/20 shadow-md group-hover:scale-105 transition-all flex items-center justify-center cursor-pointer relative overflow-hidden"
                        style={{
                          backgroundColor: hexColor,
                          boxShadow: `0 0 16px ${hexColor}70`,
                        }}
                      >
                        <Pipette className="w-4 h-4 text-white drop-shadow-md opacity-80 group-hover:opacity-100 transition-all" />
                        <input
                          type="color"
                          value={isValidHex(hexColor) ? hexColor : '#a855f7'}
                          onChange={(e) => commitHexColor(e.target.value)}
                          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                          title="Choisir une couleur"
                        />
                      </div>
                    </div>

                    <div className="relative flex-1">
                      <Hash className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                      <input
                        id="hex-input"
                        type="text"
                        value={hexDraft}
                        onChange={(e) => {
                          setHexDraft(e.target.value);
                          setHexError(false);
                        }}
                        onBlur={() => commitHexColor(hexDraft)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitHexColor(hexDraft);
                        }}
                        placeholder="#a855f7 (Entrée pour valider)"
                        aria-invalid={hexError}
                        className={`w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/[0.04] border text-xs font-mono text-white focus:outline-none shadow-inner uppercase ${
                          hexError ? 'border-red-500/60' : 'border-white/[0.1] theme-accent-border'
                        }`}
                      />
                    </div>

                    <div
                      style={{ backgroundColor: hexColor }}
                      className="px-4 py-2.5 rounded-xl text-xs font-mono font-bold text-white shadow-lg border border-white/30 text-center shrink-0"
                    >
                      Aperçu Thème
                    </div>
                  </div>
                  {hexError && (
                    <p className="text-[11px] text-red-400 mt-1.5 font-mono">
                      Format invalide — utilisez #RGB ou #RRGGBB (ex: #a855f7).
                    </p>
                  )}
                </div>

                {/* Presets Grid */}
                <div className="space-y-2 pt-4 border-t border-white/[0.08]">
                  <label className="text-xs font-medium text-gray-300 block">
                    Palettes de Couleurs Recommandées :
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {presetColors.map((p) => (
                      <button
                        key={p.hex}
                        onClick={() => commitHexColor(p.hex)}
                        className={`p-3 rounded-xl flex items-center justify-between border transition-all cursor-pointer ${
                          hexColor.toLowerCase() === p.hex.toLowerCase()
                            ? 'border-white bg-white/10 shadow-lg scale-[1.02]'
                            : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-4 h-4 rounded-full shadow border border-white/20"
                            style={{ backgroundColor: p.hex }}
                          />
                          <span className="text-xs font-medium text-white">{p.name}</span>
                        </div>
                        {hexColor.toLowerCase() === p.hex.toLowerCase() && (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Background Canvas Toggle */}
                <div className="pt-4 border-t border-white/[0.08]">
                  <SettingRow
                    title="Fond Canvas Animé Réactif"
                    description="Afficher les vagues de lumière colorées réactives en arrière-plan"
                    checked={canvasBg}
                    onToggle={toggleCanvasBg}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Sub-Page 2: Serveurs & Auto-Restart */}
          {activeSubTab === 'process' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="border-b border-white/[0.08] pb-4">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-400" />
                  <span>Gestion des Serveurs & Auto-Restart</span>
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  Configurez le comportement des processus de développement et des consoles de logs.
                </p>
              </div>

              <div className="space-y-4">
                <SettingRow
                  title="Auto-Restart Anti-Crash"
                  description="Relancer automatiquement un serveur local s'il plante ou s'arrête brutalement (max 3 relances / 2 min)"
                  checked={autoRestart}
                  onToggle={toggleAutoRestart}
                />

                <SettingRow
                  title="Filtrage des Serveurs Arrêtés (Terminal)"
                  description="N'afficher dans la barre d'onglets du terminal que les serveurs actuellement en cours d'exécution"
                  checked={hideStoppedServers}
                  onToggle={toggleHideStoppedServers}
                />

                <SettingRow
                  title="Nettoyage Automatique des Codes ANSI"
                  description="Formater et nettoyer les caractères de couleurs bruts dans le flux de logs"
                  checked={cleanAnsiLogs}
                  onToggle={toggleCleanAnsiLogs}
                />
              </div>
            </div>
          )}

          {/* Sub-Page 3: Système & Fenêtres */}
          {activeSubTab === 'system' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="border-b border-white/[0.08] pb-4">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Monitor className="w-5 h-5 text-cyan-400" />
                  <span>Système, Fenêtres & Notifications</span>
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  Définissez l'intégration du système Windows et le comportement de fermeture de Portly.
                </p>
              </div>

              <div className="space-y-4">
                {/* Auto Update Action Card */}
                <div className="glass-card p-4 rounded-xl flex items-center justify-between border theme-accent-border bg-white/[0.02]">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl theme-accent-badge flex items-center justify-center shadow-md">
                      <Download className="w-4 h-4 theme-accent-text" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white flex items-center gap-2">
                        <span>Mises à Jour Automatiques Portly</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full theme-accent-badge border border-white/10">v{pkg.version}</span>
                      </div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        Rechercher et installer les nouvelles releases officielles depuis GitHub Releases
                      </div>
                    </div>
                  </div>
                  {onOpenUpdateModal && (
                    <button
                      onClick={onOpenUpdateModal}
                      className="py-2 px-4 rounded-xl theme-accent-btn text-white text-xs font-bold flex items-center gap-2 shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Vérifier les Mises à Jour</span>
                    </button>
                  )}
                </div>

                <SettingRow
                  title="Réduire dans la Barre des Tâches (Bouton Croix X)"
                  description="Le bouton X masque Portly dans le tray (décochez pour quitter complètement l'application)"
                  checked={minimizeToTray}
                  onToggle={toggleMinimizeToTray}
                />

                <SettingRow
                  title="Notifications Systèmes Windows OS"
                  description="Transmettre les alertes dans le Centre de Notifications de Windows (en bas à droite de la barre des tâches)"
                  checked={notifWindows}
                  onToggle={toggleNotifWindows}
                />

                <SettingRow
                  title="Notifications In-App (Toasts Néons)"
                  description="Afficher les alertes visuelles flottantes en bas à droite de l'application Portly"
                  checked={notifApp}
                  onToggle={toggleNotifApp}
                />

                <SettingRow
                  title="Démarrage Automatique avec Windows"
                  description="Inscrire Portly dans le Registre OS Windows pour se lancer automatiquement à l'ouverture de session"
                  checked={autoStart}
                  onToggle={toggleAutoStart}
                />

                {/* Global Keyboard Shortcut Switcher */}
                <div className="glass-card p-4 rounded-xl flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold text-white flex items-center gap-2">
                      <Keyboard className="w-4 h-4 theme-accent-text" />
                      <span>Raccourci Clavier Global OS (Show / Hide)</span>
                    </div>
                    <div className="text-[11px] text-gray-400 mt-0.5">
                      Afficher ou masquer Portly depuis n'importe quelle application Windows
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <ShortcutRecorder value={globalShortcut} onChange={handleUpdateShortcut} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sub-Page 4: Sauvegarde & Restauration */}
          {activeSubTab === 'backup' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="border-b border-white/[0.08] pb-4">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-emerald-400" />
                  <span>Sauvegarde & Restauration de Données</span>
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  Exportez ou importez vos projets, serveurs et configurations en 1 clic.
                </p>
              </div>

              <div className="space-y-4">
                {/* AI Skill Download Card */}
                <div className="p-4 rounded-2xl bg-white/[0.03] border theme-accent-border space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl theme-accent-badge flex items-center justify-center shrink-0">
                        <Bot className="w-5 h-5 theme-accent-text" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">Skill IA (Claude, Antigravity, Cursor)</div>
                        <div className="text-[10px] theme-accent-text font-mono">
                          Instruction /portly pour vos agents IA
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={handleCopySkill}
                        className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white text-xs font-medium border border-white/10 transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        {copiedSkill ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-gray-300" />}
                        <span>{copiedSkill ? 'Copié !' : 'Copier'}</span>
                      </button>

                      <button
                        onClick={handleDownloadSkill}
                        className="px-3 py-1.5 rounded-xl theme-accent-btn text-white text-xs font-semibold shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>SKILL.md</span>
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-300">
                    Ajoutez ce fichier <code className="theme-accent-text font-mono">SKILL.md</code> dans votre assistant IA (Claude Code, Antigravity, Cursor) pour qu'il puisse inscrire vos nouveaux projets dans Portly en tapant simplement <code className="theme-accent-text font-mono">/portly</code>.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Export Button */}
                  <button
                    onClick={handleExportConfig}
                    className="p-4 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-left transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <Download className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">Exporter les Projets</div>
                        <div className="text-[10px] text-emerald-400 font-mono">Format JSON</div>
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-300">
                      Télécharger un fichier de sauvegarde `.json` contenant tous vos projets et serveurs configurés.
                    </p>
                  </button>

                  {/* Import Button */}
                  <label className="p-4 rounded-2xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-left transition-all cursor-pointer group block">
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportConfig}
                      className="hidden"
                    />
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <Upload className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">Importer une Configuration</div>
                        <div className="text-[10px] text-blue-400 font-mono">Restaurer Backup JSON</div>
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-300">
                      Sélectionnez un fichier `.json` pour restaurer instantanément tous vos projets sur cette machine.
                    </p>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                    <div className="text-xs text-gray-400 font-medium">Projets Inscrits</div>
                    <div className="text-lg font-bold text-white theme-accent-text font-mono mt-1">{projects.length} projet(s)</div>
                  </div>

                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                    <div className="text-xs text-gray-400 font-medium">Stockage Local</div>
                    <div className="text-sm font-bold text-emerald-400 font-mono mt-1 truncate">
                      AppData/Roaming/portly
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/[0.08]">
                  <button
                    onClick={handleResetDefaults}
                    className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 hover:text-white text-xs font-medium border border-white/[0.08] transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Réinitialiser les Préférences Visuelles</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
