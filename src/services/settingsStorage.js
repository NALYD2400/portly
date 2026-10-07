// Keep both generations of preference keys in sync during the Portly → Sprint migration.
const KEYS = {
  custom_hex: 'custom_hex',
  canvas_bg: 'cfg_canvas',
  auto_restart: 'cfg_autorestart',
  hide_stopped_servers: 'cfg_hidestopped',
  clean_ansi_logs: 'cfg_cleanansi',
  minimize_to_tray: 'cfg_minimizetotray',
  notif_windows: 'cfg_notif_windows',
  notif_app: 'cfg_notif_app',
  global_shortcut: 'cfg_shortcut',
};

export function readStoredSetting(field, fallback = null) {
  const suffix = KEYS[field];
  if (!suffix) throw new Error('Réglage inconnu : ' + field);
  return localStorage.getItem('sprint_' + suffix) ?? localStorage.getItem('portly_' + suffix) ?? fallback;
}

export function writeStoredSetting(field, value) {
  const suffix = KEYS[field];
  if (!suffix) throw new Error('Réglage inconnu : ' + field);
  for (const prefix of ['portly', 'sprint']) localStorage.setItem(prefix + '_' + suffix, String(value));
}

export function loadStoredSettings() {
  return {
    custom_hex: readStoredSetting('custom_hex', '#a855f7'),
    canvas_bg: readStoredSetting('canvas_bg') !== 'false',
    auto_restart: readStoredSetting('auto_restart') === 'true',
    hide_stopped_servers: readStoredSetting('hide_stopped_servers') !== 'false',
    clean_ansi_logs: readStoredSetting('clean_ansi_logs') !== 'false',
    minimize_to_tray: readStoredSetting('minimize_to_tray') !== 'false',
    notif_windows: readStoredSetting('notif_windows') !== 'false',
    notif_app: readStoredSetting('notif_app') !== 'false',
    global_shortcut: readStoredSetting('global_shortcut', 'Ctrl+Alt+P'),
    autostart: false,
  };
}

export function syncStoredSettings(settings) {
  for (const field of Object.keys(KEYS)) {
    if (settings[field] === undefined) continue;
    writeStoredSetting(field, settings[field]);
  }
  window.dispatchEvent(new Event('portly_canvas_toggle'));
}
