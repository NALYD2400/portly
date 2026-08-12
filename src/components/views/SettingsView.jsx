import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Settings, Palette, Zap, Monitor, Shield, Check, Sparkles, RefreshCw, Hash, Bell, Terminal, Activity, FileArchive, Folder, ChevronRight, Sliders, Laptop, Download, Upload, FileJson, Bot, Copy, Pipette, Keyboard } from 'lucide-react';
import ToggleSwitch from '../ui/ToggleSwitch';

function hexToRgbStr(hex) {
  if (!hex || !hex.startsWith('#')) return '168, 85, 247';
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const num = parseInt(c, 16);
  if (isNaN(num)) return '168, 85, 247';
  return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
}

function ShortcutRecorder({ value, onChange }) {
  const [isRecording, setIsRecording] = useState(false);

  const handleKeyDown = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;

    const parts = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');

    if (!e.ctrlKey && !e.altKey) {
      parts.unshift('Ctrl');
    }

    let keyName = e.key.toUpperCase();
    if (keyName === ' ') keyName = 'Space';

    parts.push(keyName);
    const newShortcut = parts.join('+');

    onChange(newShortcut);
    setIsRecording(false);
  };

  return (
    <button
      type="button"
      onClick={() => setIsRecording(true)}
      onKeyDown={isRecording ? handleKeyDown : undefined}
      onBlur={() => setIsRecording(false)}
      className={`px-4 py-2 rounded-xl border text-xs font-mono font-bold transition-all duration-200 cursor-pointer shadow-inner min-w-[150px] text-center ${
        isRecording
          ? 'bg-purple-500/20 text-purple-300 border-purple-500 animate-pulse'
          : 'bg-white/[0.05] hover:bg-white/[0.1] theme-accent-text border-white/10'
      }`}
    >
      {isRecording ? '⌨️ Appuyez sur les touches...' : value || 'Cliquer pour enregistrer'}
    </button>
  );
}

export default function SettingsView({ projects = [] }) {
  const [activeSubTab, setActiveSubTab] = useState('appearance');

  // Theme Accent
  const [hexColor, setHexColor] = useState(() => {
    return localStorage.getItem('portly_custom_hex') || '#a855f7';
  });

  // Toggles State
  const [canvasBg, setCanvasBg] = useState(() => localStorage.getItem('portly_cfg_canvas') !== 'false');
  const [autoRestart, setAutoRestart] = useState(() => localStorage.getItem('portly_cfg_autorestart') === 'true');
  const [hideStoppedServers, setHideStoppedServers] = useState(() => localStorage.getItem('portly_cfg_hidestopped') !== 'false');
  const [cleanAnsiLogs, setCleanAnsiLogs] = useState(true);
  const [minimizeToTray, setMinimizeToTray] = useState(() => localStorage.getItem('portly_cfg_minimizetotray') !== 'false');
  const [notifWindows, setNotifWindows] = useState(() => localStorage.getItem('portly_cfg_notif_windows') !== 'false');
  const [notifApp, setNotifApp] = useState(() => localStorage.getItem('portly_cfg_notif_app') !== 'false');
  const [autoStart, setAutoStart] = useState(false);
  const [globalShortcut, setGlobalShortcut] = useState(
    () => localStorage.getItem('portly_cfg_shortcut') || 'Ctrl+Alt+P'
  );

  useEffect(() => {
    invoke('register_global_shortcut_cmd', { shortcut: globalShortcut }).catch(() => {});
  }, [globalShortcut]);

  const handleUpdateShortcut = (value) => {
    setGlobalShortcut(value);
    localStorage.setItem('portly_cfg_shortcut', value);
    showAutoSaved();
  };

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [copiedSkill, setCopiedSkill] = useState(false);

  const skillMarkdown = `---
name: portly
description: Automatically adds, registers, and manages codebases/projects in Portly (the high-performance Rust-powered developer process supervisor). Use when the user types /portly or asks to register, track, configure, or inspect projects in Portly.
---

# Portly v0.2.0 Project Supervisor Skill

This skill registers, configures, and manages active codebase projects in **Portly** (\`C:\\Users\\dylan\\AppData\\Roaming\\portly\\projects.json\`).

## Portly v0.2.0 System Architecture

- **GitHub Repository**: [NALYD2400/portly](https://github.com/NALYD2400/portly)
- **Local Application Path**: \`C:\\Users\\dylan\\AppData\\Local\\Portly\\portly.exe\`
- **Config Storage**: \`C:\\Users\\dylan\\AppData\\Roaming\\portly\\projects.json\`
- **Native Rust Engine**: High-performance process manager with asynchronous stdout/stderr log streaming and real-time CPU/RAM telemetry polling (every 2s).
- **Auto-Stop Child Processes on Exit**: On app exit or tray quit, Portly automatically terminates all spawned dev child server processes (\`taskkill /F /T\`) to prevent orphaned processes.
- **In-App Auto-Updater**: Directly connects to GitHub Releases (\`NALYD2400/portly\`) with an animated download progress modal (\`AutoUpdateModal.jsx\`).
- **Glassmorphism Motion UI System**: Fully responsive dark mode with dynamic theme accent color synchronization (\`--accent-color\` and \`--accent-color-rgb\`) for badges, spotlight glows, specular buttons, and background canvas waves.

---

## Workflow: Registering a Project (\`/portly\`)

When the user types \`/portly\` or requests to configure a project in Portly:

1. **Detect Stack & Dev Commands**:
   - **Root Path**: Workspace root directory.
   - **Project Name**: Folder basename or \`name\` field in \`package.json\` / \`Cargo.toml\`.
   - **Framework Detection Rules**:
     - **Next.js / Vite / React / Vue / Svelte**: \`npm run dev\` (Port \`3000\` or \`5173\`)
     - **Tauri / Rust**: \`npm run tauri dev\` or \`cargo run\` (Port \`4313\` / \`8080\`)
     - **Express / Node**: \`node server.js\` (Port \`7737\` or \`3000\`)
     - **Python (FastAPI/Flask/Django)**: \`python main.py\` or \`uvicorn main:app --reload\` (Port \`8000\`)
     - **Go**: \`go run .\` (Port \`8080\`)

2. **Update \`projects.json\`**:
   - Read \`C:\\Users\\dylan\\AppData\\Roaming\\portly\\projects.json\`.
   - If \`root == current_workspace_root\` exists, update dev commands if needed.
   - If missing, append a new project configuration with servers.
   - Save formatted JSON back to \`C:\\Users\\dylan\\AppData\\Roaming\\portly\\projects.json\`.

3. **User Confirmation**:
   - Return a concise markdown summary confirming project registration, detected stack, assigned port, and dev command.`;

  const handleDownloadSkill = () => {
    const blob = new Blob([skillMarkdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'SKILL.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopySkill = () => {
    navigator.clipboard.writeText(skillMarkdown);
    setCopiedSkill(true);
    setTimeout(() => setCopiedSkill(false), 2000);
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
    } catch (e) {
      console.error('Failed to export config:', e);
    }
  };

  const handleImportConfig = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        if (Array.isArray(importedData)) {
          await invoke('save_projects_cmd', { projects: importedData });
          alert('Configuration importée avec succès !');
          window.location.reload();
        } else {
          alert('Format de fichier de sauvegarde invalide.');
        }
      } catch (err) {
        alert('Erreur lors de la lecture du fichier JSON.');
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

  const showAutoSaved = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const applyHexColor = (color) => {
    if (!color || !color.startsWith('#')) return;
    setHexColor(color);
    localStorage.setItem('portly_custom_hex', color);

    const rgbStr = hexToRgbStr(color);
    document.documentElement.style.setProperty('--accent-color', color);
    document.documentElement.style.setProperty('--accent-color-rgb', rgbStr);
    showAutoSaved();
  };

  useEffect(() => {
    applyHexColor(hexColor);
  }, []);

  const toggleCanvasBg = (val) => {
    setCanvasBg(val);
    localStorage.setItem('portly_cfg_canvas', val ? 'true' : 'false');
    window.dispatchEvent(new Event('portly_canvas_toggle'));
    showAutoSaved();
  };

  const toggleAutoRestart = (val) => {
    setAutoRestart(val);
    localStorage.setItem('portly_cfg_autorestart', val ? 'true' : 'false');
    showAutoSaved();
  };

  const toggleHideStoppedServers = (val) => {
    setHideStoppedServers(val);
    localStorage.setItem('portly_cfg_hidestopped', val ? 'true' : 'false');
    showAutoSaved();
  };

  const toggleCleanAnsiLogs = (val) => {
    setCleanAnsiLogs(val);
    localStorage.setItem('portly_cfg_cleanansi', val ? 'true' : 'false');
    showAutoSaved();
  };

  const toggleMinimizeToTray = (val) => {
    setMinimizeToTray(val);
    localStorage.setItem('portly_cfg_minimizetotray', val ? 'true' : 'false');
    showAutoSaved();
  };

  const toggleNotifWindows = (val) => {
    setNotifWindows(val);
    localStorage.setItem('portly_cfg_notif_windows', val ? 'true' : 'false');
    showAutoSaved();
  };

  const toggleNotifApp = (val) => {
    setNotifApp(val);
    localStorage.setItem('portly_cfg_notif_app', val ? 'true' : 'false');
    showAutoSaved();
  };

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
    } catch (e) {
      console.error('Failed to update autostart:', e);
    }
    showAutoSaved();
  };

  const handleResetDefaults = () => {
    applyHexColor('#a855f7');
    toggleCanvasBg(true);
    toggleAutoRestart(false);
    toggleHideStoppedServers(true);
    toggleCleanAnsiLogs(true);
    toggleNotifications(true);
    toggleMinimizeToTray(true);
    toggleAutoStart(false);
  };

  const menuNav = [
    { id: 'appearance', label: 'Apparence & Couleurs (#HEX)', icon: Palette, desc: 'Thèmes, variables CSS et canvas' },
    { id: 'process', label: 'Serveurs & Auto-Restart', icon: Zap, desc: 'Gestion des crashs et logs' },
    { id: 'system', label: 'Système & Fenêtres', icon: Monitor, desc: 'Bouton X, notifications et autorun' },
    { id: 'backup', label: 'Sauvegarde & Diagnostic', icon: Shield, desc: 'Backup ZIP bureau et stockage' },
  ];

  return (
    <div className="w-full space-y-6 animate-fadeIn select-none pb-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white/[0.05] theme-accent-text border theme-accent-border flex items-center justify-center shadow-lg">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Paramètres Portly</h1>
            <p className="text-xs text-gray-400">
              Personnalisation avancée de l'interface, des processus et des préférences système.
            </p>
          </div>
        </div>
      </div>

      {/* Sub-Pages Settings Layout (Sidebar Navigation + Dedicated Page) */}
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
                  <label className="text-xs font-medium text-gray-300 block mb-2">
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
                          value={hexColor}
                          onChange={(e) => applyHexColor(e.target.value)}
                          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                          title="Choisir une couleur"
                        />
                      </div>
                    </div>

                    <div className="relative flex-1">
                      <Hash className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                      <input
                        type="text"
                        value={hexColor}
                        onChange={(e) => applyHexColor(e.target.value)}
                        placeholder="#a855f7"
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.1] text-xs font-mono text-white focus:outline-none theme-accent-border uppercase shadow-inner"
                      />
                    </div>

                    <div
                      style={{ backgroundColor: hexColor }}
                      className="px-4 py-2.5 rounded-xl text-xs font-mono font-bold text-white shadow-lg border border-white/30 text-center shrink-0"
                    >
                      Aperçu Thème
                    </div>
                  </div>
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
                        onClick={() => applyHexColor(p.hex)}
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
                  <div
                    onClick={() => toggleCanvasBg(!canvasBg)}
                    className="glass-card p-4 rounded-xl flex items-center justify-between cursor-pointer select-none"
                  >
                    <div>
                      <div className="text-xs font-semibold text-white">Fond Canvas Animé Réactif</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        Afficher les vagues de lumière colorées réactives en arrière-plan
                      </div>
                    </div>
                    <ToggleSwitch checked={canvasBg} onChange={toggleCanvasBg} />
                  </div>
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
                <div
                  onClick={() => toggleAutoRestart(!autoRestart)}
                  className="glass-card p-4 rounded-xl flex items-center justify-between cursor-pointer select-none"
                >
                  <div>
                    <div className="text-xs font-semibold text-white">Auto-Restart Anti-Crash</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">
                      Relancer automatiquement un serveur local s'il plante ou s'arrête brutalement
                    </div>
                  </div>
                  <ToggleSwitch checked={autoRestart} onChange={toggleAutoRestart} />
                </div>

                <div
                  onClick={() => toggleHideStoppedServers(!hideStoppedServers)}
                  className="glass-card p-4 rounded-xl flex items-center justify-between cursor-pointer select-none"
                >
                  <div>
                    <div className="text-xs font-semibold text-white">Filtrage des Serveurs Arrêtés (Terminal)</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">
                      N'afficher dans la barre d'onglets du terminal que les serveurs actuellement en cours d'exécution
                    </div>
                  </div>
                  <ToggleSwitch checked={hideStoppedServers} onChange={toggleHideStoppedServers} />
                </div>

                <div
                  onClick={() => toggleCleanAnsiLogs(!cleanAnsiLogs)}
                  className="glass-card p-4 rounded-xl flex items-center justify-between cursor-pointer select-none"
                >
                  <div>
                    <div className="text-xs font-semibold text-white">Nettoyage Automatique des Codes ANSI</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">
                      Formater et nettoyer les caractères de couleurs bruts dans le flux de logs
                    </div>
                  </div>
                  <ToggleSwitch checked={cleanAnsiLogs} onChange={toggleCleanAnsiLogs} />
                </div>
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
                <div
                  onClick={() => toggleMinimizeToTray(!minimizeToTray)}
                  className="glass-card p-4 rounded-xl flex items-center justify-between cursor-pointer select-none"
                >
                  <div>
                    <div className="text-xs font-semibold text-white">Fermeture Complète Directe (Bouton Croix X)</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">
                      Fermer et quitter 100% complètement Portly lors du clic sur le bouton X (sans zone de notification)
                    </div>
                  </div>
                  <ToggleSwitch checked={!minimizeToTray} onChange={(val) => toggleMinimizeToTray(!val)} />
                </div>

                <div
                  onClick={() => toggleNotifWindows(!notifWindows)}
                  className="glass-card p-4 rounded-xl flex items-center justify-between cursor-pointer select-none"
                >
                  <div>
                    <div className="text-xs font-semibold text-white">Notifications Systèmes Windows OS</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">
                      Transmettre les alertes dans le Centre de Notifications de Windows (en bas à droite de la barre des tâches)
                    </div>
                  </div>
                  <ToggleSwitch checked={notifWindows} onChange={toggleNotifWindows} />
                </div>

                <div
                  onClick={() => toggleNotifApp(!notifApp)}
                  className="glass-card p-4 rounded-xl flex items-center justify-between cursor-pointer select-none"
                >
                  <div>
                    <div className="text-xs font-semibold text-white">Notifications In-App (Toasts Néons)</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">
                      Afficher les alertes visuelles flottantes en bas à droite de l'application Portly
                    </div>
                  </div>
                  <ToggleSwitch checked={notifApp} onChange={toggleNotifApp} />
                </div>

                <div
                  onClick={() => toggleAutoStart(!autoStart)}
                  className="glass-card p-4 rounded-xl flex items-center justify-between cursor-pointer select-none"
                >
                  <div>
                    <div className="text-xs font-semibold text-white">Démarrage Automatique avec Windows</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">
                      Inscrire Portly dans le Registre OS Windows pour se lancer automatiquement à l'ouverture de session
                    </div>
                  </div>
                  <ToggleSwitch checked={autoStart} onChange={toggleAutoStart} />
                </div>

                {/* Global Keyboard Shortcut Switcher */}
                <div className="glass-card p-4 rounded-xl flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold text-white flex items-center gap-2">
                      <Keyboard className="w-4 h-4 text-purple-400" />
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

          {/* Sub-Page 4: Sauvegarde & Restauration de Données */}
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
                <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/30 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                        <Bot className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">Skill IA (Claude, Antigravity, Cursor)</div>
                        <div className="text-[10px] text-purple-300 font-mono">
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
                    Ajoutez ce fichier <code className="text-purple-300 font-mono">SKILL.md</code> dans votre assistant IA (Claude Code, Antigravity, Cursor) pour qu'il puisse inscrire vos nouveaux projets dans Portly en tapant simplement <code className="text-purple-300 font-mono">/portly</code>.
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
                    <div className="text-lg font-bold text-white font-[#a855f7] font-mono mt-1">{projects.length} projet(s)</div>
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
