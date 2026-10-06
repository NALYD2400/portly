import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Check, Download, Copy, Keyboard, ArrowUp, ArrowDown, RotateCcw } from 'lucide-react';
import SettingRow from '../ui/SettingRow';
import PageHeader from '../ui/PageHeader';
import { DEFAULT_PREFS } from '../../services/prefs';
import { DASHBOARD_BLOCKS, DEFAULT_DASHBOARD, dashboardPrefs } from '../../services/dashboardPrefs';
import { triggerToast } from '../../services/toastBus';
import ConfirmDialog from '../ui/ConfirmDialog';
import DisplayPrefs from '../ui/DisplayPrefs';
import pkg from '../../../package.json';
import { applyAccent } from '../../services/accent';

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
        className={`px-4 py-2 rounded-lg border text-xs font-mono font-semibold transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
          isRecording
            ? 'theme-accent-active animate-pulse border-white/30'
            : 'bg-white/[0.04] hover:bg-white/[0.08] border-[var(--line)] text-white'
        }`}
      >
        <Keyboard className="w-3.5 h-3.5 theme-accent-text" />
        <span>
          {isRecording
            ? '⌨️ Appuyez sur les touches... (Esc pour annuler)'
            : 'Modifier le raccourci'}
        </span>
      </button>

      {!isRecording && (
        <div className="flex items-center gap-1">
          {keys.map((k, idx) => (
            <kbd
              key={idx}
              className="px-2.5 py-1 rounded-lg bg-black/40 border border-[var(--line-strong)] text-xs font-mono font-semibold theme-accent-text"
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
  { name: 'Violet', hex: '#a855f7', desc: 'Thème emblématique Sprint' },
  { name: 'Cyan', hex: '#06b6d4', desc: 'Lumineux & ultra-lisible' },
  { name: 'Émeraude', hex: '#10b981', desc: 'Énergique & moderne' },
  { name: 'Rose', hex: '#ec4899', desc: 'Vibrant & contrasté' },
  { name: 'Ambre', hex: '#f59e0b', desc: 'Chaud & dynamique' },
  { name: 'Bleu', hex: '#3b82f6', desc: 'Calme & professionnel' },
  { name: 'Rouge', hex: '#ef4444', desc: 'Audacieux & percutant' },
  { name: 'Vert', hex: '#22c55e', desc: 'Classique console de dev' },
];

const Select = ({ label, value, options, onChange }) => (
  <select
    aria-label={label}
    className="control-input"
    value={value}
    onChange={(event) => onChange(event.target.value)}
  >
    {options.map(([id, text]) => (
      <option value={id} key={id}>
        {text}
      </option>
    ))}
  </select>
);

export default function SettingsView({
  projects = [],
  onOpenUpdateModal,
  reloadProjects,
  prefs,
  onPrefsChange,
  initialSection = 'appearance',
}) {
  const [activeTab, setActiveTab] = useState(initialSection);

  // Unified Settings State
  const [settings, setSettings] = useState({
    custom_hex:
      localStorage.getItem('sprint_custom_hex') ||
      localStorage.getItem('portly_custom_hex') ||
      '#a855f7',
    canvas_bg:
      (localStorage.getItem('sprint_cfg_canvas') ?? localStorage.getItem('portly_cfg_canvas')) !==
      'false',
    auto_restart:
      (localStorage.getItem('sprint_cfg_autorestart') ??
        localStorage.getItem('portly_cfg_autorestart')) === 'true',
    hide_stopped_servers:
      (localStorage.getItem('sprint_cfg_hidestopped') ??
        localStorage.getItem('portly_cfg_hidestopped')) !== 'false',
    clean_ansi_logs:
      (localStorage.getItem('sprint_cfg_cleanansi') ??
        localStorage.getItem('portly_cfg_cleanansi')) !== 'false',
    minimize_to_tray:
      (localStorage.getItem('sprint_cfg_minimizetotray') ??
        localStorage.getItem('portly_cfg_minimizetotray')) !== 'false',
    notif_windows:
      (localStorage.getItem('sprint_cfg_notif_windows') ??
        localStorage.getItem('portly_cfg_notif_windows')) !== 'false',
    notif_app:
      (localStorage.getItem('sprint_cfg_notif_app') ??
        localStorage.getItem('portly_cfg_notif_app')) !== 'false',
    global_shortcut:
      localStorage.getItem('sprint_cfg_shortcut') ||
      localStorage.getItem('portly_cfg_shortcut') ||
      'Ctrl+Alt+P',
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
          applyAccent(backendSettings.custom_hex);
          // Sync localStorage
          localStorage.setItem('portly_custom_hex', backendSettings.custom_hex);
          localStorage.setItem('portly_cfg_canvas', String(backendSettings.canvas_bg));
          localStorage.setItem('portly_cfg_autorestart', String(backendSettings.auto_restart));
          localStorage.setItem(
            'portly_cfg_hidestopped',
            String(backendSettings.hide_stopped_servers),
          );
          localStorage.setItem('portly_cfg_cleanansi', String(backendSettings.clean_ansi_logs));
          localStorage.setItem(
            'portly_cfg_minimizetotray',
            String(backendSettings.minimize_to_tray),
          );
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
    [],
  );

  const showAutoSaved = () => {
    setSavedSuccess(true);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSavedSuccess(false), 2000);
  };

  const saveUpdatedSettings = (newSettings, silent = false) => {
    setSettings(newSettings);
    // Sync backend Rust
    invoke('save_settings_cmd', { settings: newSettings })
      .then(() => {
        if (!silent) showAutoSaved();
      })
      .catch((error) =>
        triggerToast({
          title: 'Enregistrement impossible',
          message: String(error),
          type: 'error',
        }),
      );
  };

  const commitHexColor = (candidate) => {
    const trimmed = candidate.trim();
    if (isValidHex(trimmed)) {
      setHexError(false);
      setHexDraft(trimmed);
      applyAccent(trimmed);
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

  const executeResetDefaults = async () => {
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
    try {
      await invoke('register_global_shortcut_cmd', {
        shortcut: def.global_shortcut,
      });
      await invoke('set_autostart_cmd', { enable: false });
      await invoke('save_settings_cmd', { settings: def });
    } catch (error) {
      triggerToast({
        title: 'Réinitialisation incomplète',
        message: String(error),
        type: 'error',
      });
      return;
    }
    onPrefsChange({ ...DEFAULT_PREFS, dashboard: { ...DEFAULT_DASHBOARD } });
    setSettings(def);
    setHexDraft('#a855f7');
    applyAccent('#a855f7');
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
    showAutoSaved();
    setConfirmReset(false);
    triggerToast({
      title: '🔄 Paramètres Réinitialisés',
      message: 'Toutes les préférences par défaut ont été restaurées.',
      type: 'info',
    });
  };

  const config = dashboardPrefs(prefs?.dashboard);
  const changeDashboard = (patch) => {
    onPrefsChange({ dashboard: { ...config, ...patch } });
    showAutoSaved();
  };
  const moveBlock = (id, direction) => {
    const blocks = [...config.blocks];
    const index = blocks.indexOf(id);
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
    changeDashboard({ blocks });
  };
  const toggleSetting = (key, storageKey, value) => {
    localStorage.setItem(storageKey, String(value));
    saveUpdatedSettings({ ...settings, [key]: value });
    if (key === 'canvas_bg') window.dispatchEvent(new Event('portly_canvas_toggle'));
  };
  const categories = [
    ['appearance', 'Apparence', 'Thème, couleur et confort de lecture.'],
    ['dashboard', 'Tableau de bord', 'Composez votre vue d’ensemble.'],
    ['supervision', 'Serveurs & logs', 'Comportement des serveurs et du journal.'],
    ['system', 'Système', 'Raccourcis, démarrage et notifications.'],
    ['storage', 'Sauvegardes', 'Exportez ou restaurez vos projets.'],
    ['ai-skill', 'Assistants IA', 'Configurez Sprint avec votre assistant.'],
    ['about', 'À propos', 'Version et mises à jour.'],
  ];

  return (
    <div className="page workspace-page settings-page animate-fadeIn">
      <PageHeader
        title="Paramètres"
        lead="Une interface à votre façon."
        actions={
          <button className="quiet-button" onClick={() => setConfirmReset(true)}>
            <RotateCcw size={14} />
            Réinitialiser
          </button>
        }
      />
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Sections des paramètres">
          {categories.map(([id, label]) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              aria-current={activeTab === id ? 'page' : undefined}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="settings-content">
          <div className="settings-section-heading">
            <h2>{categories.find(([id]) => id === activeTab)?.[1]}</h2>
            <p>{categories.find(([id]) => id === activeTab)?.[2]}</p>
          </div>
          <div className="settings-save-status" role="status">
            {savedSuccess ? 'Enregistré' : 'Enregistrement automatique'}
          </div>
          {activeTab === 'appearance' && (
            <>
              <DisplayPrefs
                prefs={prefs}
                onChange={(patch) => {
                  onPrefsChange(patch);
                  showAutoSaved();
                }}
              />
              <section className="settings-group">
                <h3>Couleur d’accent</h3>
                <p className="settings-help">Pour les actions et les éléments sélectionnés.</p>
                <div className="accent-options">
                  {PRESET_PALETTES.map((palette) => (
                    <button
                      key={palette.hex}
                      aria-label={palette.name}
                      title={palette.name}
                      aria-pressed={settings.custom_hex.toLowerCase() === palette.hex.toLowerCase()}
                      style={{ backgroundColor: palette.hex }}
                      onClick={() => commitHexColor(palette.hex)}
                    >
                      {settings.custom_hex.toLowerCase() === palette.hex.toLowerCase() && (
                        <Check size={15} color="#fff" />
                      )}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    aria-label="Couleur personnalisée"
                    value={settings.custom_hex}
                    onChange={(event) => commitHexColor(event.target.value)}
                    className="color-input"
                  />
                  <input
                    id="hex-custom-input"
                    aria-label="Code couleur hexadécimal"
                    className="control-input w-36"
                    value={hexDraft}
                    aria-invalid={hexError}
                    onChange={(event) => {
                      setHexDraft(event.target.value);
                      setHexError(false);
                    }}
                    onBlur={() => commitHexColor(hexDraft)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') commitHexColor(hexDraft);
                    }}
                  />
                  <button className="btn" onClick={() => commitHexColor(hexDraft)}>
                    Appliquer
                  </button>
                </div>
                {hexError && (
                  <p role="alert" className="text-xs text-rose-400 mt-2">
                    Utilisez une couleur valide, par exemple #06b6d4.
                  </p>
                )}
              </section>
              <SettingRow
                title="Arrière-plan animé"
                description="Une touche de couleur discrète derrière les pages."
                checked={settings.canvas_bg}
                onToggle={(value) => toggleSetting('canvas_bg', 'portly_cfg_canvas', value)}
              />
              <SettingRow
                title="Barre latérale compacte"
                description="Afficher uniquement les icônes de navigation."
                checked={prefs.sidebarCollapsed}
                onToggle={(value) => onPrefsChange({ sidebarCollapsed: value })}
              />
            </>
          )}
          {activeTab === 'dashboard' && (
            <>
              <SettingRow
                title="Mesures affichées"
                description="Choisissez les ressources que vous souhaitez suivre."
              >
                <Select
                  label="Mesures affichées"
                  value={config.scope}
                  options={[
                    ['projects', 'Mes projets'],
                    ['system', 'Tout l’ordinateur'],
                  ]}
                  onChange={(scope) => changeDashboard({ scope })}
                />
              </SettingRow>
              <SettingRow title="Style des graphiques">
                <Select
                  label="Style des graphiques"
                  value={config.chartStyle}
                  options={[
                    ['area', 'Aire'],
                    ['line', 'Courbe'],
                    ['bars', 'Barres'],
                  ]}
                  onChange={(chartStyle) => changeDashboard({ chartStyle })}
                />
              </SettingRow>
              <SettingRow
                title="Période visible"
                description="Historique conservé pendant cette session."
              >
                <Select
                  label="Période visible"
                  value={config.period}
                  options={[
                    [60, '1 minute'],
                    [300, '5 minutes'],
                    [900, '15 minutes'],
                  ]}
                  onChange={(period) => changeDashboard({ period: Number(period) })}
                />
              </SettingRow>
              <SettingRow
                title="Affichage compact"
                description="Réduire l’espacement des statistiques et des serveurs."
                checked={config.compact}
                onToggle={(compact) => changeDashboard({ compact })}
              />
              <section className="settings-group">
                <div className="flex justify-between items-baseline">
                  <h3>Blocs & ordre d’affichage</h3>
                  <button
                    className="quiet-button"
                    onClick={() => changeDashboard(DEFAULT_DASHBOARD)}
                  >
                    Restaurer
                  </button>
                </div>
                <p className="settings-help">Masquez les blocs inutiles et déplacez les autres.</p>
                {config.blocks.map((id, index) => {
                  const block = DASHBOARD_BLOCKS.find((item) => item.id === id);
                  return (
                    <SettingRow key={id} title={block.label} description={block.description}>
                      <div className="flex gap-2 items-center">
                        <button
                          className="icon-button"
                          aria-label={'Monter ' + block.label}
                          disabled={index === 0}
                          onClick={() => moveBlock(id, -1)}
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label={'Descendre ' + block.label}
                          disabled={index === config.blocks.length - 1}
                          onClick={() => moveBlock(id, 1)}
                        >
                          <ArrowDown size={14} />
                        </button>
                        <input
                          type="checkbox"
                          className="dashboard-checkbox"
                          aria-label={'Afficher ' + block.label}
                          checked={!config.hidden.includes(id)}
                          onChange={(event) =>
                            changeDashboard({
                              hidden: event.target.checked
                                ? config.hidden.filter((hidden) => hidden !== id)
                                : [...config.hidden, id],
                            })
                          }
                        />
                      </div>
                    </SettingRow>
                  );
                })}
              </section>
            </>
          )}
          {activeTab === 'supervision' && (
            <>
              <SettingRow
                title="Relancer après un crash"
                description="Jusqu’à 3 tentatives en 2 minutes pour éviter les relances en boucle."
                checked={settings.auto_restart}
                onToggle={(value) => toggleSetting('auto_restart', 'portly_cfg_autorestart', value)}
              />
              <SettingRow
                title="Masquer les serveurs arrêtés"
                description="Le journal s’ouvre sur les serveurs actifs. Vous pouvez toujours afficher les autres."
                checked={settings.hide_stopped_servers}
                onToggle={(value) =>
                  toggleSetting('hide_stopped_servers', 'portly_cfg_hidestopped', value)
                }
              />
              <SettingRow
                title="Nettoyer les codes ANSI"
                description="Garder des logs lisibles, avec les erreurs et succès en couleur."
                checked={settings.clean_ansi_logs}
                onToggle={(value) =>
                  toggleSetting('clean_ansi_logs', 'portly_cfg_cleanansi', value)
                }
              />
              <p className="settings-note">
                Les limites de mémoire se règlent pour chaque serveur dans Projets.
              </p>
            </>
          )}
          {activeTab === 'system' && (
            <>
              <SettingRow
                title="Raccourci global"
                description="Afficher ou masquer Sprint depuis une autre application."
              >
                <ShortcutRecorder
                  value={settings.global_shortcut}
                  onChange={handleUpdateShortcut}
                />
              </SettingRow>
              <SettingRow
                title="Fermer dans la zone de notification"
                description="La croix masque la fenêtre et laisse vos serveurs en marche."
                checked={settings.minimize_to_tray}
                onToggle={(value) =>
                  toggleSetting('minimize_to_tray', 'portly_cfg_minimizetotray', value)
                }
              />
              <SettingRow
                title="Lancer avec Windows"
                checked={settings.autostart}
                onToggle={toggleAutoStart}
              />
              <SettingRow
                title="Notifications dans Sprint"
                checked={settings.notif_app}
                onToggle={(value) => toggleSetting('notif_app', 'portly_cfg_notif_app', value)}
              />
              <SettingRow
                title="Notifications Windows"
                checked={settings.notif_windows}
                onToggle={(value) =>
                  toggleSetting('notif_windows', 'portly_cfg_notif_windows', value)
                }
              />
            </>
          )}
          {activeTab === 'storage' && (
            <>
              <SettingRow title="Dossier de configuration" description={configDirPath}>
                <button className="btn" onClick={handleOpenConfigDir}>
                  Ouvrir le dossier
                </button>
              </SettingRow>
              <SettingRow
                title="Exporter les projets"
                description="Télécharger la configuration des projets au format JSON."
              >
                <button className="btn" onClick={handleExportConfig}>
                  Exporter
                </button>
              </SettingRow>
              <SettingRow
                title="Restaurer une sauvegarde"
                description="Remplacer la liste de projets par une sauvegarde JSON."
              >
                <label className="btn">
                  Importer
                  <input
                    aria-label="Importer une sauvegarde"
                    type="file"
                    accept=".json"
                    onChange={handleImportConfig}
                    className="sr-only"
                  />
                </label>
              </SettingRow>
              <p className="settings-note">
                {projects.length} projets enregistrés ·{' '}
                {projects.reduce((count, project) => count + (project.servers || []).length, 0)}{' '}
                serveurs configurés
              </p>
            </>
          )}
          {activeTab === 'ai-skill' && (
            <>
              <p className="settings-help">
                Le skill Sprint permet à votre assistant de configurer les projets et leurs
                commandes.
              </p>
              <div className="flex gap-2 flex-wrap mt-4">
                <button className="btn" onClick={handleCopySkill}>
                  <Copy size={14} />
                  {copiedSkill ? 'Copié' : 'Copier le skill'}
                </button>
                <button className="btn" onClick={handleDownloadSkill}>
                  <Download size={14} />
                  Télécharger
                </button>
              </div>
              <details className="skill-details">
                <summary>Voir le contenu du skill</summary>
                <pre>{SKILL_MARKDOWN}</pre>
              </details>
            </>
          )}
          {activeTab === 'about' && (
            <>
              <SettingRow title="Sprint" description={'Version ' + pkg.version}>
                <button className="btn" onClick={onOpenUpdateModal}>
                  Mises à jour
                </button>
              </SettingRow>
              <SettingRow
                title="Code source"
                description="Retrouvez le projet et ses versions sur GitHub."
              >
                <button
                  className="btn"
                  onClick={() =>
                    invoke('open_browser', {
                      url: 'https://github.com/NALYD2400/portly',
                    })
                  }
                >
                  GitHub
                </button>
              </SettingRow>
            </>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={confirmReset}
        title="Réinitialiser les paramètres ?"
        message="Restaurer les préférences d’affichage, les réglages du tableau de bord et les options de Sprint. Vos projets sont conservés."
        confirmLabel="Réinitialiser"
        onConfirm={executeResetDefaults}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  );
}
