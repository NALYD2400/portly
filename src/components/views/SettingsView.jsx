import React, { useState, useEffect, useRef, useId } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Settings,
  Palette,
  Zap,
  Monitor,
  Check,
  Sparkles,
  RefreshCw,
  Hash,
  ChevronRight,
  Download,
  Upload,
  Bot,
  Copy,
  Pipette,
  Keyboard,
  ExternalLink,
  FolderOpen,
  Info,
  Sliders,
  Cpu,
  Layers,
  Bell,
  HardDrive,
  Code,
  Radio,
  Terminal,
} from 'lucide-react';
import ToggleSwitch from '../ui/ToggleSwitch';
import { triggerToast } from '../../services/toastBus';
import ConfirmDialog from '../ui/ConfirmDialog';
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

  const keys = (value || 'Ctrl+Alt+P').split('+');

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => setIsRecording(!isRecording)}
        className={`px-4 py-2 rounded-xl border text-xs font-mono font-bold transition-all duration-200 cursor-pointer shadow-inner flex items-center gap-1.5 ${
          isRecording
            ? 'theme-accent-active animate-pulse border-white/30'
            : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-white'
        }`}
      >
        <Keyboard className="w-3.5 h-3.5 theme-accent-text" />
        <span>{isRecording ? '⌨️ Appuyez sur les touches... (Esc pour annuler)' : 'Modifier le raccourci'}</span>
      </button>

      {!isRecording && (
        <div className="flex items-center gap-1">
          {keys.map((k, idx) => (
            <kbd
              key={idx}
              className="px-2.5 py-1 rounded-lg bg-black/60 border border-white/15 text-xs font-mono font-extrabold theme-accent-text shadow-sm"
            >
              {k}
            </kbd>
          ))}
        </div>
      )}
    </div>
  );
}

const SKILL_MARKDOWN = [
  '---',
  'name: sprint',
  'description: Automatically adds, registers, and manages codebases/projects in Sprint (the high-performance Rust-powered developer process supervisor). Use when the user types /sprint or asks to register, track, configure, or inspect projects in Sprint.',
  '---',
  '',
  '# Sprint v' + pkg.version + ' Project Supervisor Skill',
  '',
  'This skill registers, configures, and manages active codebase projects in **Sprint** (`%APPDATA%\\sprint\\projects.json`).',
  '',
  '## System Architecture',
  '',
  '- **GitHub Repository**: [NALYD2400/portly](https://github.com/NALYD2400/portly)',
  '- **Config Storage**: `%APPDATA%\\sprint\\projects.json`',
  '- **Native Rust Engine**: Process manager with asynchronous stdout/stderr log streaming and real-time CPU/RAM telemetry polling (every 2s).',
  '- **Auto-Stop Child Processes on Exit**: On app exit or tray quit, Sprint terminates all spawned dev servers (taskkill /F /T) to prevent orphaned processes.',
  '- **Auto-Restart & RAM Guard**: Servers that crash (or exceed their configured RAM limit) are automatically restarted with a cooldown.',
  '- **In-App Auto-Updater**: Connects to GitHub Releases with signature-domain validation and an animated progress modal.',
  '',
  '---',
  '',
  '## Workflow: Registering a Project (/sprint)',
  '',
  '1. **Detect Stack & Dev Commands**:',
  '   - **Root Path**: Workspace root directory.',
  '   - **Project Name**: Folder basename or `name` field in `package.json` / `Cargo.toml`.',
  '   - **Framework Detection Rules**:',
  '     - **Next.js / Vite / React / Vue / Svelte / Astro**: `npm run dev` (Port 3000 or 5173)',
  '     - **Tauri / Rust**: `npm run tauri dev` or `cargo run`',
  '     - **Express / NestJS / Node**: `node server.js` or `npm run start:dev`',
  '     - **Python (FastAPI/Flask/Django)**:',
  '       `python main.py` or `uvicorn main:app --reload` (Port 8000)',
  '     - **Go**: `go run .` (Port 8080)',
  '',
  '2. **Update projects.json**:',
  '   - Read `%APPDATA%\\sprint\\projects.json`.',
  '   - If `root == current_workspace_root` exists, update dev commands if needed.',
  '   - If missing, append a new project configuration with servers.',
  '   - Save formatted JSON back.',
  '',
  '3. **User Confirmation**:',
  '   - Return a concise markdown summary confirming project registration, detected stack, assigned port, and dev command.',
].join('\n');

const PRESET_PALETTES = [
  { name: 'Violet Cyberpunk', hex: '#a855f7', desc: 'Thème emblématique Sprint' },
  { name: 'Cyan Néon', hex: '#06b6d4', desc: 'Lumineux & ultra-lisible' },
  { name: 'Émeraude Tech', hex: '#10b981', desc: 'Énergique & moderne' },
  { name: 'Rose Synthwave', hex: '#ec4899', desc: 'Vibrant & contrasté' },
  { name: 'Or Solaire', hex: '#f59e0b', desc: 'Chaud & dynamique' },
  { name: 'Bleu Électrique', hex: '#3b82f6', desc: 'Calme & professionnel' },
  { name: 'Rouge Crimson', hex: '#ef4444', desc: 'Audacieux & percutant' },
  { name: 'Vert Matrix', hex: '#22c55e', desc: 'Classique console de dev' },
];

export default function SettingsView({ projects = [], onOpenUpdateModal, reloadProjects }) {
  const [activeTab, setActiveTab] = useState('appearance');

 // Unified Settings State
 const [settings, setSettings] = useState({
    custom_hex: localStorage.getItem('sprint_custom_hex') || localStorage.getItem('portly_custom_hex') || '#a855f7',
    canvas_bg: (localStorage.getItem('sprint_cfg_canvas') ?? localStorage.getItem('portly_cfg_canvas')) !== 'false',
    auto_restart: (localStorage.getItem('sprint_cfg_autorestart') ?? localStorage.getItem('portly_cfg_autorestart')) === 'true',
    hide_stopped_servers: (localStorage.getItem('sprint_cfg_hidestopped') ?? localStorage.getItem('portly_cfg_hidestopped')) !== 'false',
    clean_ansi_logs: (localStorage.getItem('sprint_cfg_cleanansi') ?? localStorage.getItem('portly_cfg_cleanansi')) !== 'false',
    minimize_to_tray: (localStorage.getItem('sprint_cfg_minimizetotray') ?? localStorage.getItem('portly_cfg_minimizetotray')) !== 'false',
    notif_windows: (localStorage.getItem('sprint_cfg_notif_windows') ?? localStorage.getItem('portly_cfg_notif_windows')) !== 'false',
    notif_app: (localStorage.getItem('sprint_cfg_notif_app') ?? localStorage.getItem('portly_cfg_notif_app')) !== 'false',
    global_shortcut: localStorage.getItem('sprint_cfg_shortcut') || localStorage.getItem('portly_cfg_shortcut') || 'Ctrl+Alt+P',
    autostart: false,
  });

  const [hexDraft, setHexDraft] = useState(settings.custom_hex);
  const [hexError, setHexError] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [copiedSkill, setCopiedSkill] = useState(false);
  const [configDirPath, setConfigDirPath] = useState('%APPDATA%/sprint');
  const [confirmReset, setConfirmReset] = useState(false);

  const savedTimerRef = useRef(null);
  const copiedTimerRef = useRef(null);

  // Load unified settings from Rust backend at launch
  useEffect(() => {
    invoke('get_settings_cmd')
      .then((backendSettings) => {
        if (backendSettings) {
          setSettings((prev) => ({ ...prev, ...backendSettings }));
          setHexDraft(backendSettings.custom_hex);
          applyAccentColor(backendSettings.custom_hex);
          // Sync localStorage
          localStorage.setItem('portly_custom_hex', backendSettings.custom_hex);
          localStorage.setItem('portly_cfg_canvas', String(backendSettings.canvas_bg));
          localStorage.setItem('portly_cfg_autorestart', String(backendSettings.auto_restart));
          localStorage.setItem('portly_cfg_hidestopped', String(backendSettings.hide_stopped_servers));
          localStorage.setItem('portly_cfg_cleanansi', String(backendSettings.clean_ansi_logs));
          localStorage.setItem('portly_cfg_minimizetotray', String(backendSettings.minimize_to_tray));
          localStorage.setItem('portly_cfg_notif_windows', String(backendSettings.notif_windows));
          localStorage.setItem('portly_cfg_notif_app', String(backendSettings.notif_app));
          localStorage.setItem('portly_cfg_shortcut', backendSettings.global_shortcut);
        }
      })
      .catch(() => {});

    invoke('is_autostart_cmd')
      .then((enabled) => {
        setSettings((prev) => ({ ...prev, autostart: !!enabled }));
      })
      .catch(() => {});
  }, []);

  useEffect(
    () => () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    },
    []
  );

  const showAutoSaved = () => {
    setSavedSuccess(true);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSavedSuccess(false), 2000);
  };

  const applyAccentColor = (color) => {
    document.documentElement.style.setProperty('--accent-color', color);
    document.documentElement.style.setProperty('--accent-color-rgb', hexToRgbStr(color));
  };

  const saveUpdatedSettings = (newSettings, silent = false) => {
    setSettings(newSettings);
    // Sync backend Rust
    invoke('save_settings_cmd', { settings: newSettings }).catch((e) => {
      console.warn('Failed to save settings to backend:', e);
    });

    if (!silent) showAutoSaved();
  };

  const commitHexColor = (candidate) => {
    const trimmed = candidate.trim();
    if (isValidHex(trimmed)) {
      setHexError(false);
      setHexDraft(trimmed);
      applyAccentColor(trimmed);
      localStorage.setItem('portly_custom_hex', trimmed);
      const updated = { ...settings, custom_hex: trimmed };
      saveUpdatedSettings(updated);
    } else {
      setHexError(true);
    }
  };

  const handleUpdateShortcut = (value) => {
    invoke('register_global_shortcut_cmd', { shortcut: value })
      .then(() => {
        localStorage.setItem('portly_cfg_shortcut', value);
        const updated = { ...settings, global_shortcut: value };
        saveUpdatedSettings(updated);
        triggerToast({
          title: '⌨️ Raccourci Enregistré',
          message: `Nouveau raccourci global: ${value}`,
          type: 'success',
        });
      })
      .catch((e) => {
        triggerToast({
          title: '⚠️ Raccourci Refusé',
          message: String(e),
          type: 'error',
        });
      });
  };

  const toggleAutoStart = async (val) => {
    try {
      await invoke('set_autostart_cmd', { enable: val });
      const updated = { ...settings, autostart: val };
      saveUpdatedSettings(updated);
     triggerToast({
       title: val ? '🚀 Démarrage Windows Activé' : '⏹ Démarrage Windows Désactivé',
       message: val
          ? 'Sprint se lancera automatiquement à la connexion.'
          : 'Sprint ne se lancera plus automatiquement.',
       type: 'info',
     });
   } catch (e) {
     triggerToast({
       title: '⚠️ Échec du Réglage OS',
       message: `Impossible de modifier le démarrage automatique: ${String(e)}`,
       type: 'error',
     });
   }
 };

 const handleOpenConfigDir = async () => {
   try {
     const path = await invoke('open_config_dir_cmd');
     setConfigDirPath(path);
     triggerToast({
       title: '📂 Dossier de Configuration',
        message: 'Explorateur ouvert dans le dossier AppData/sprint',
       type: 'info',
     });
    } catch (e) {
      triggerToast({
        title: '⚠️ Explorateur',
        message: String(e),
        type: 'error',
      });
    }
  };

  const handleExportConfig = async () => {
    try {
      const currentProjects = await invoke('get_projects_cmd');
      const dataStr = JSON.stringify(currentProjects || [], null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sprint_config_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      triggerToast({
        title: '📦 Export Réussi',
        message: 'Sauvegarde de vos projets téléchargée avec succès.',
        type: 'success',
      });
    } catch (e) {
      triggerToast({
        title: "⚠️ Échec de l'Export",
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
            message: 'Le fichier ne contient pas une liste valide de projets Sprint.',
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
          title: "⚠️ Échec de l'Import",
          message: 'Impossible de lire le fichier JSON fourni.',
          type: 'error',
        });
      }
    };
    reader.readAsText(file);
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
    triggerToast({
      title: '📋 Skill IA Copié !',
      message: 'Collez ce contenu dans votre workspace IA.',
      type: 'success',
      duration: 2000,
    });
  };

  const executeResetDefaults = () => {
    const def = {
      custom_hex: '#a855f7',
      canvas_bg: true,
      auto_restart: false,
      hide_stopped_servers: true,
      clean_ansi_logs: true,
      minimize_to_tray: true,
      notif_windows: true,
      notif_app: true,
      global_shortcut: 'Ctrl+Alt+P',
      autostart: false,
    };
    setSettings(def);
    setHexDraft('#a855f7');
    applyAccentColor('#a855f7');
    localStorage.setItem('portly_custom_hex', '#a855f7');
    localStorage.setItem('portly_cfg_canvas', 'true');
    localStorage.setItem('portly_cfg_autorestart', 'false');
    localStorage.setItem('portly_cfg_hidestopped', 'true');
    localStorage.setItem('portly_cfg_cleanansi', 'true');
    localStorage.setItem('portly_cfg_minimizetotray', 'true');
    localStorage.setItem('portly_cfg_notif_windows', 'true');
    localStorage.setItem('portly_cfg_notif_app', 'true');
    localStorage.setItem('portly_cfg_shortcut', 'Ctrl+Alt+P');
    window.dispatchEvent(new Event('portly_canvas_toggle'));
    saveUpdatedSettings(def);
    setConfirmReset(false);
    triggerToast({
      title: '🔄 Paramètres Réinitialisés',
      message: 'Toutes les préférences par défaut ont été restaurées.',
      type: 'info',
    });
  };

  const navCategories = [
    {
      id: 'appearance',
      label: 'Thème & Apparence',
      icon: Palette,
      badge: settings.custom_hex,
      badgeColor: settings.custom_hex,
      desc: 'Couleur (#HEX), fond canvas et style',
    },
    {
      id: 'supervision',
      label: 'Supervision & Processus',
      icon: Zap,
      desc: 'Auto-restart, logs ANSI et RAM Guard',
    },
    {
      id: 'system',
      label: 'Système & Raccourcis',
      icon: Monitor,
      desc: 'Raccourci global, tray et notifications',
    },
    {
      id: 'storage',
      label: 'Sauvegarde & Stockage',
      icon: HardDrive,
      desc: 'Export/Import JSON et données AppData',
    },
    {
      id: 'ai-skill',
      label: 'Skill IA & Agents',
      icon: Bot,
      badge: 'Agentic',
      desc: 'Intégration Claude, Cursor, Antigravity',
    },
    {
      id: 'about',
      label: 'À Propos & Mises à Jour',
      icon: Info,
      badge: `v${pkg.version}`,
      desc: 'Version, GitHub et vérification MAJ',
    },
  ];

  const SettingRow = ({
    title,
    description,
    checked,
    onToggle,
    icon: IconComponent,
    children,
  }) => {
    const labelId = useId();
    const descId = useId();

    return (
      <div
        role="button"
        tabIndex={0}
        aria-labelledby={labelId}
        aria-describedby={descId}
        onClick={() => onToggle && onToggle(!checked)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (onToggle) onToggle(!checked);
          }
        }}
        className="glass-card p-4 rounded-2xl flex items-center justify-between border border-white/[0.06] hover:border-white/15 transition-all duration-200 select-none group focus:outline-none focus:ring-1 focus:ring-white/20"
      >
        <div className="flex items-start gap-3.5 pr-4">
          {IconComponent && (
            <div className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
              <IconComponent className="w-4 h-4 theme-accent-text" />
            </div>
          )}
          <div>
            <div id={labelId} className="text-xs font-bold text-white tracking-tight flex items-center gap-2">
              <span>{title}</span>
            </div>
            <div id={descId} className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">
              {description}
            </div>
          </div>
        </div>
        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
          {children || <ToggleSwitch checked={!!checked} onChange={(val) => onToggle && onToggle(val)} />}
        </div>
      </div>
    );
  };

  const totalServersCount = projects.reduce((acc, p) => acc + (p.servers || []).length, 0);

  return (
    <div className="w-full space-y-6 animate-fadeIn select-none pb-12">
      {/* Top Header Card */}
      <div className="glass-panel p-6 rounded-3xl border theme-accent-border bg-gradient-to-r from-[#0d0b1a] via-[#120e29] to-[#0d0b1a] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl theme-accent-btn flex items-center justify-center shadow-lg shrink-0">
            <Settings className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-extrabold text-white tracking-tight">Paramètres Sprint</h1>
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full theme-accent-badge border border-white/10">
                v{pkg.version}
              </span>
              {savedSuccess && (
                <span className="flex items-center gap-1 text-xs font-bold text-emerald-400 font-sans animate-fadeIn">
                  <Check className="w-3.5 h-3.5" /> Enregistré !
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Configuration du moteur de supervision, personnalisation du thème et préférences système.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setConfirmReset(true)}
            className="px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 hover:text-white text-xs font-medium border border-white/10 transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
            title="Restaurer les valeurs par défaut"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Réinitialiser</span>
          </button>

          {onOpenUpdateModal && (
            <button
              onClick={onOpenUpdateModal}
              className="px-4 py-2 rounded-xl theme-accent-btn text-white text-xs font-bold flex items-center gap-2 shadow-lg hover:brightness-110 active:scale-95 transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Mises à Jour</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Settings Navigation & Content Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 min-h-[520px]">
        {/* Navigation Sidebar (4 cols) */}
        <div className="md:col-span-4 lg:col-span-4 glass-panel p-3 rounded-3xl border border-white/[0.08] bg-black/40 space-y-1.5 flex flex-col justify-between shadow-xl">
          <div className="space-y-1">
            <div className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-wider text-gray-400 font-mono flex items-center justify-between">
              <span>Préférences</span>
              <Sliders className="w-3 h-3 theme-accent-text" />
            </div>

            {navCategories.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeTab === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveTab(cat.id)}
                  className={`w-full flex items-center justify-between p-3.5 rounded-2xl text-left transition-all duration-200 cursor-pointer border ${
                    isActive
                      ? 'theme-accent-active border-white/20 shadow-lg font-bold'
                      : 'border-transparent text-gray-400 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                        isActive ? 'theme-accent-btn text-white border-white/20' : 'bg-white/[0.04] border-white/10 text-gray-400'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate flex items-center gap-2">
                        <span>{cat.label}</span>
                        {cat.badge && (
                          <span
                            className="text-[9px] font-mono font-extrabold px-1.5 py-0.2 rounded-full border border-white/10 theme-accent-badge"
                            style={cat.badgeColor ? { backgroundColor: `${cat.badgeColor}25`, color: cat.badgeColor } : {}}
                          >
                            {cat.badge}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-400 font-normal truncate mt-0.5">{cat.desc}</div>
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${isActive ? 'theme-accent-text translate-x-0.5' : 'opacity-0'}`} />
                </button>
              );
            })}
          </div>

          {/* Quick System Status Card at Bottom of Sidebar */}
          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.06] mt-4 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-gray-400 font-mono">Projets enregistrés</span>
              <span className="font-bold text-white font-mono theme-accent-text">{projects.length}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-gray-400 font-mono">Serveurs configurés</span>
              <span className="font-bold text-white font-mono">{totalServersCount}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-gray-400 font-mono">Raccourci global</span>
              <span className="font-bold font-mono text-[10px] px-1.5 py-0.5 rounded theme-accent-badge">
                {settings.global_shortcut}
              </span>
            </div>
          </div>
        </div>

        {/* Dedicated Tab Content (8 cols) */}
        <div className="md:col-span-8 lg:col-span-8 glass-panel p-6 rounded-3xl border border-white/[0.08] bg-black/40 shadow-2xl overflow-hidden">
          {/* TAB 1: APPARENCE & THÈMES */}
          {activeTab === 'appearance' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="border-b border-white/[0.08] pb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Palette className="w-5 h-5 theme-accent-text" />
                    <span>Personnalisation Thème & Couleurs</span>
                  </h2>
                  <p className="text-xs text-gray-400 mt-1">
                    Définissez la couleur thématique (#HEX) synchronisée en direct sur les boutons, bordures et néons.
                  </p>
                </div>
              </div>

              {/* Live Interactive Accent Preview Banner */}
              <div className="p-4 rounded-2xl border theme-accent-border bg-gradient-to-r from-black/60 to-[#120e29]/80 flex items-center justify-between gap-4 shadow-xl">
                <div className="flex items-center gap-3.5">
                  <div
                    className="w-10 h-10 rounded-xl shadow-lg flex items-center justify-center border border-white/20"
                    style={{
                      backgroundColor: settings.custom_hex,
                      boxShadow: `0 0 20px ${settings.custom_hex}80`,
                    }}
                  >
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">Aperçu en Direct du Thème</div>
                    <div className="text-[11px] theme-accent-text font-mono mt-0.5 font-bold">
                      Couleur active : {settings.custom_hex} (RGB: {hexToRgbStr(settings.custom_hex)})
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full theme-accent-badge shadow-sm">
                    Badge Actif
                  </span>
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-xl theme-accent-btn text-white text-xs font-bold shadow-md cursor-default"
                  >
                    Bouton Accent
                  </button>
                </div>
              </div>

              {/* Custom Hex Picker Input */}
              <div className="space-y-3">
                <label htmlFor="hex-custom-input" className="text-xs font-bold text-gray-200 block">
                  Couleur d'Accentuation Personnalisée (#HEX) :
                </label>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  {/* Pipette / Native Color Input Swatch */}
                  <div className="relative group shrink-0">
                    <div
                      className="w-11 h-11 rounded-2xl border-2 border-white/20 shadow-md group-hover:scale-105 transition-all flex items-center justify-center cursor-pointer relative overflow-hidden"
                      style={{
                        backgroundColor: settings.custom_hex,
                        boxShadow: `0 0 16px ${settings.custom_hex}70`,
                      }}
                    >
                      <Pipette className="w-4 h-4 text-white drop-shadow-md opacity-80 group-hover:opacity-100 transition-all" />
                      <input
                        type="color"
                        value={isValidHex(settings.custom_hex) ? settings.custom_hex : '#a855f7'}
                        onChange={(e) => commitHexColor(e.target.value)}
                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                        title="Sélectionner une couleur personnalisée"
                      />
                    </div>
                  </div>

                  <div className="relative flex-1">
                    <Hash className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                    <input
                      id="hex-custom-input"
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
                      className={`w-full pl-9 pr-4 py-2.5 rounded-2xl bg-white/[0.04] border text-xs font-mono text-white focus:outline-none shadow-inner uppercase font-bold ${
                        hexError ? 'border-red-500/60' : 'border-white/[0.1] theme-accent-border'
                      }`}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => commitHexColor(hexDraft)}
                    className="px-4 py-2.5 rounded-2xl theme-accent-btn text-white text-xs font-bold transition-all cursor-pointer shadow-md active:scale-95 shrink-0"
                  >
                    Appliquer
                  </button>
                </div>

                {hexError && (
                  <p className="text-[11px] text-red-400 font-mono">
                    Format de couleur invalide. Utilisez un code hexadécimal valide (ex: #a855f7).
                  </p>
                )}
              </div>

              {/* Preset Curated Palettes Grid */}
              <div className="space-y-3 pt-4 border-t border-white/[0.08]">
                <label className="text-xs font-bold text-gray-200 block">
                  Palettes Thématiques Recommandées :
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {PRESET_PALETTES.map((p) => {
                    const isSelected = settings.custom_hex.toLowerCase() === p.hex.toLowerCase();
                    return (
                      <button
                        key={p.hex}
                        type="button"
                        onClick={() => commitHexColor(p.hex)}
                        className={`p-3 rounded-2xl flex items-center justify-between border transition-all duration-200 cursor-pointer text-left ${
                          isSelected
                            ? 'border-white bg-white/10 shadow-lg scale-[1.02]'
                            : 'border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/15'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="w-4 h-4 rounded-full shadow border border-white/20 shrink-0"
                            style={{
                              backgroundColor: p.hex,
                              boxShadow: `0 0 8px ${p.hex}80`,
                            }}
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate">{p.name}</div>
                            <div className="text-[9px] text-gray-400 font-mono truncate">{p.hex}</div>
                          </div>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Reactive Canvas Background Toggle */}
              <div className="pt-4 border-t border-white/[0.08]">
                <SettingRow
                  title="Fond Canvas Animé Réactif (Color Bends)"
                  description="Afficher les douces vagues de lumière colorées interactives en arrière-plan"
                  checked={settings.canvas_bg}
                  icon={Layers}
                  onToggle={(val) => {
                    localStorage.setItem('portly_cfg_canvas', String(val));
                    window.dispatchEvent(new Event('portly_canvas_toggle'));
                    const updated = { ...settings, canvas_bg: val };
                    saveUpdatedSettings(updated);
                  }}
                />
              </div>
            </div>
          )}

          {/* TAB 2: SUPERVISION & PROCESSUS */}
          {activeTab === 'supervision' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="border-b border-white/[0.08] pb-4">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-400" />
                  <span>Supervision & Auto-Restart Anti-Crash</span>
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  Règles de relance automatique des processus en cas de plantage et options des flux de logs.
                </p>
              </div>

              <div className="space-y-4">
                <SettingRow
                  title="Auto-Restart Anti-Crash"
                  description="Relance automatiquement un serveur de développement s'il plante de manière inattendue (protection crash-loop : max 3 relances en 2 minutes)"
                  checked={settings.auto_restart}
                  icon={Zap}
                  onToggle={(val) => {
                    localStorage.setItem('portly_cfg_autorestart', String(val));
                    const updated = { ...settings, auto_restart: val };
                    saveUpdatedSettings(updated);
                  }}
                />

                <SettingRow
                  title="Filtrage des Serveurs Arrêtés (Consoles)"
                  description="N'afficher dans la barre d'onglets du terminal que les serveurs actuellement en cours d'exécution pour alléger la vue"
                  checked={settings.hide_stopped_servers}
                  icon={Radio}
                  onToggle={(val) => {
                    localStorage.setItem('portly_cfg_hidestopped', String(val));
                    const updated = { ...settings, hide_stopped_servers: val };
                    saveUpdatedSettings(updated);
                  }}
                />

                <SettingRow
                  title="Nettoyage Automatique des Séquences ANSI"
                  description="Filtrer et nettoyer les codes ANSI bruts dans les flux de logs tout en conservant la coloration sémantique (erreurs en rouge, succès en vert)"
                  checked={settings.clean_ansi_logs}
                  icon={Code}
                  onToggle={(val) => {
                    localStorage.setItem('portly_cfg_cleanansi', String(val));
                    const updated = { ...settings, clean_ansi_logs: val };
                    saveUpdatedSettings(updated);
                  }}
                />

                {/* Auto-Guard RAM Info Banner */}
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex items-start gap-3.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20 mt-0.5">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">Auto-Guard RAM Natif (Moteur Rust)</div>
                    <div className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                      Chaque serveur dispose d'une limite de mémoire RAM configurable individuellement (ex: 500 Mo). Si le processus ou ses sous-processus dépassent ce seuil, le superviseur Rust le redémarre proprement avec un cooldown de sécurité de 30 secondes pour libérer la mémoire.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SYSTÈME & RACCOURCIS */}
          {activeTab === 'system' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="border-b border-white/[0.08] pb-4">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Monitor className="w-5 h-5 text-cyan-400" />
                  <span>Système, Tray & Raccourcis Globaux</span>
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  Intégration avec le système d'exploitation Windows, raccourci global et centre de notifications.
                </p>
              </div>

              <div className="space-y-4">
                {/* Global Keyboard Shortcut Card */}
                <div className="glass-card p-4 rounded-2xl border border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="w-8 h-8 rounded-xl theme-accent-badge flex items-center justify-center shrink-0 mt-0.5">
                      <Keyboard className="w-4 h-4 theme-accent-text" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Raccourci Clavier Global Windows (Show / Hide)</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        Affiche ou masque instantanément Sprint depuis n'importe quelle application
                      </div>
                    </div>
                  </div>

                  <ShortcutRecorder
                    value={settings.global_shortcut}
                    onChange={handleUpdateShortcut}
                  />
                </div>

                <SettingRow
                  title="Réduire dans la Barre des Tâches (Bouton Croix X)"
                  description="Le bouton X masque la fenêtre dans la zone de notification sans couper vos serveurs (décochez pour quitter complètement l'application)"
                  checked={settings.minimize_to_tray}
                  icon={Monitor}
                  onToggle={(val) => {
                    localStorage.setItem('portly_cfg_minimizetotray', String(val));
                    const updated = { ...settings, minimize_to_tray: val };
                    saveUpdatedSettings(updated);
                  }}
                />

                <SettingRow
                  title="Démarrage Automatique avec Windows"
                  description="Lancer Sprint en arrière-plan dès l'ouverture de votre session Windows"
                  checked={settings.autostart}
                  icon={Zap}
                  onToggle={toggleAutoStart}
                />

                <SettingRow
                  title="Notifications In-App (Toasts Néons)"
                  description="Afficher les alertes visuelles flottantes en bas à droite de l'interface Sprint"
                  checked={settings.notif_app}
                  icon={Sparkles}
                  onToggle={(val) => {
                    localStorage.setItem('portly_cfg_notif_app', String(val));
                    const updated = { ...settings, notif_app: val };
                    saveUpdatedSettings(updated);
                  }}
                />

                <SettingRow
                  title="Notifications Systèmes Windows (Action Center)"
                  description="Transmettre les alertes de démarrage/crash au Centre de Notifications natif de Windows"
                  checked={settings.notif_windows}
                  icon={Bell}
                  onToggle={(val) => {
                    localStorage.setItem('portly_cfg_notif_windows', String(val));
                    const updated = { ...settings, notif_windows: val };
                    saveUpdatedSettings(updated);
                  }}
                />
              </div>
            </div>
          )}

          {/* TAB 4: SAUVEGARDE & STOCKAGE */}
          {activeTab === 'storage' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="border-b border-white/[0.08] pb-4">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <HardDrive className="w-5 h-5 text-emerald-400" />
                  <span>Sauvegarde, Restauration & Stockage</span>
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  Gestion des fichiers de configuration, export/import JSON et accès aux données locales.
                </p>
              </div>

              <div className="space-y-4">
                {/* Storage Location Card with Direct Explorer Open */}
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20 mt-0.5">
                      <FolderOpen className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Répertoire Local de Configuration</div>
                      <div className="text-[11px] font-mono text-emerald-400 mt-0.5 truncate max-w-md">
                        {configDirPath}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleOpenConfigDir}
                    className="px-3.5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white text-xs font-semibold border border-white/10 transition-all flex items-center gap-1.5 cursor-pointer shrink-0 active:scale-95"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>Ouvrir dans l'Explorateur</span>
                  </button>
                </div>

                {/* Export / Import Bento Actions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={handleExportConfig}
                    className="p-4 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/25 text-left transition-all cursor-pointer group active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <Download className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">Exporter la Configuration</div>
                        <div className="text-[10px] text-emerald-400 font-mono">Fichier backup .json</div>
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-300 leading-relaxed">
                      Télécharger une copie complète de vos projets, serveurs et variables d'environnement.
                    </p>
                  </button>

                  <label className="p-4 rounded-2xl bg-blue-500/10 hover:bg-blue-500/15 border border-blue-500/25 text-left transition-all cursor-pointer group block active:scale-[0.99]">
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportConfig}
                      className="hidden"
                    />
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <Upload className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">Importer une Sauvegarde</div>
                        <div className="text-[10px] text-blue-400 font-mono">Restaurer .json</div>
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-300 leading-relaxed">
                      Restaurer instantanément l'ensemble de vos projets et configurations sur cette machine.
                    </p>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: SKILL IA & AGENTS */}
          {activeTab === 'ai-skill' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="border-b border-white/[0.08] pb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Bot className="w-5 h-5 theme-accent-text" />
                    <span>Skill IA pour Agents (Claude, Cursor, Antigravity)</span>
                  </h2>
                  <p className="text-xs text-gray-400 mt-1">
                    Permettez à vos agents d'automatiser l'enregistrement de projets dans Sprint avec la commande <code className="font-mono text-emerald-400 font-bold">/sprint</code>.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {/* AI Card */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-white/[0.04] to-black/60 border theme-accent-border space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl theme-accent-btn flex items-center justify-center shrink-0 shadow-lg">
                        <Bot className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <div className="text-xs font-extrabold text-white">Skill Officiel Sprint (SKILL.md)</div>
                        <div className="text-[11px] text-gray-400 font-mono">
                          Compatible Claude Code, Cursor, Antigravity, OpenCodex
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleCopySkill}
                        className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white text-xs font-medium border border-white/10 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                      >
                        {copiedSkill ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-gray-300" />}
                        <span>{copiedSkill ? 'Copié !' : 'Copier Markdown'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleDownloadSkill}
                        className="px-3.5 py-1.5 rounded-xl theme-accent-btn text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Télécharger SKILL.md</span>
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-gray-300 leading-relaxed">
                    Placez ce fichier dans le répertoire <code className="theme-accent-text font-mono">.agents/skills/sprint/SKILL.md</code> ou <code className="theme-accent-text font-mono">.cursor/skills/</code> de votre projet pour qu'un agent IA configure automatiquement vos serveurs et ports lors de la création d'un nouveau projet.
                  </p>

                  <div className="p-3.5 rounded-xl bg-black/70 border border-white/10 font-mono text-[11px] text-gray-300 max-h-48 overflow-y-auto leading-relaxed shadow-inner">
                    <pre className="whitespace-pre-wrap">{SKILL_MARKDOWN}</pre>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: À PROPOS & MISES À JOUR */}
          {activeTab === 'about' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="border-b border-white/[0.08] pb-4">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Info className="w-5 h-5 theme-accent-text" />
                  <span>À Propos de Sprint</span>
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  Informations de version, stack technologique et suivi des mises à jour officielles.
                </p>
              </div>

              <div className="space-y-4">
                {/* Product Info Bento */}
                <div className="p-5 rounded-2xl glass-card border border-white/10 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl theme-accent-btn flex items-center justify-center shadow-lg">
                      <Terminal className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <div className="text-sm font-extrabold text-white tracking-tight flex items-center gap-2">
                        <span>Sprint Developer Supervisor</span>
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full theme-accent-badge">
                          v{pkg.version}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        Moteur natif Rust (Tauri 2) + Interface React 19 & Tailwind CSS 4
                      </div>
                    </div>
                  </div>

                  {onOpenUpdateModal && (
                    <button
                      type="button"
                      onClick={onOpenUpdateModal}
                      className="px-4 py-2 rounded-xl theme-accent-btn text-white text-xs font-bold flex items-center gap-2 shadow-lg hover:brightness-110 active:scale-95 transition-all cursor-pointer shrink-0"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Rechercher une MAJ</span>
                    </button>
                  )}
                </div>

                {/* Tech Specs Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                    <div className="text-[11px] text-gray-400 font-mono">Backend Engine</div>
                    <div className="text-xs font-extrabold text-white mt-1">Rust + Tauri 2.1</div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                    <div className="text-[11px] text-gray-400 font-mono">Frontend UI</div>
                    <div className="text-xs font-extrabold text-white mt-1">React 19 + Tailwind 4</div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                    <div className="text-[11px] text-gray-400 font-mono">Architecture</div>
                    <div className="text-xs font-extrabold text-emerald-400 font-mono mt-1">x86_64 Windows</div>
                  </div>
                </div>

                {/* GitHub Links Card */}
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Code className="w-4 h-4 theme-accent-text" />
                    <span className="text-xs font-bold text-white">Code Source & Dépôt GitHub</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => invoke('open_browser', { url: 'https://github.com/NALYD2400/portly' })}
                    className="px-3.5 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-white text-xs font-medium border border-white/10 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>github.com/NALYD2400/portly</span>
                    <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="Réinitialiser les paramètres ?"
        message="Cette action va réinitialiser le thème, les raccourcis et les préférences d'affichage à leurs valeurs par défaut. Vos projets et serveurs ne seront pas affectés."
        confirmLabel="Réinitialiser les préférences"
        danger
        onConfirm={executeResetDefaults}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  );
}



