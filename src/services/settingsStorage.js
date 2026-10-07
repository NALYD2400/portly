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

export function syncStoredSettings(settings) {
  for (const [field, suffix] of Object.entries(KEYS)) {
    if (settings[field] === undefined) continue;
    for (const prefix of ['portly', 'sprint'])
      localStorage.setItem(prefix + '_' + suffix, String(settings[field]));
  }
  window.dispatchEvent(new Event('portly_canvas_toggle'));
}
