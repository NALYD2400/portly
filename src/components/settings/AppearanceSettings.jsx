import React from 'react';
import SettingRow from '../ui/SettingRow';
import { Check } from 'lucide-react';
import DisplayPrefs from '../ui/DisplayPrefs';

const PRESET_PALETTES = [
  { name: 'Violet', hex: '#a855f7' },
  { name: 'Cyan', hex: '#06b6d4' },
  { name: 'Émeraude', hex: '#10b981' },
  { name: 'Rose', hex: '#ec4899' },
  { name: 'Ambre', hex: '#f59e0b' },
  { name: 'Bleu', hex: '#3b82f6' },
  { name: 'Rouge', hex: '#ef4444' },
  { name: 'Vert', hex: '#22c55e' },
];


export default function AppearanceSettings({ prefs, onPrefsChange, showAutoSaved, settings, hexDraft, setHexDraft, hexError, setHexError, commitHexColor, toggleSetting }) {
  return (
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
        <p className="settings-help">Pour les actions, les éléments sélectionnés et la teinte du fond.</p>
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
        description="Une teinte continue dans toute la fenêtre, en thème clair comme sombre."
        checked={settings.canvas_bg}
        onToggle={(value) => toggleSetting('canvas_bg', value)}
      />
      <div className="background-controls">
        {[
          ['backgroundIntensity', 'Intensité', 100, '%'],
          ['backgroundBlur', 'Flou', 60, 'px'],
          ['backgroundSpeed', 'Vitesse', 200, '%'],
        ].map(([key, label, max, unit]) => (
          <div className="background-control" key={key}>
            <label htmlFor={key}>
              {label}
              <output htmlFor={key}>{prefs[key]} {unit}</output>
            </label>
            <input
              id={key}
              type="range"
              min="0"
              max={max}
              step="1"
              value={prefs[key]}
              disabled={!settings.canvas_bg}
              aria-describedby="background-help"
              onChange={(event) => {
                onPrefsChange({ [key]: Number(event.target.value) });
                showAutoSaved();
              }}
            />
          </div>
        ))}
        <p id="background-help" className="settings-help">
          À 0 % d’intensité, le fond est uni. À 0 % de vitesse, la couleur reste fixe.
          Les animations réduites gardent aussi un fond fixe.
        </p>
      </div>
      <SettingRow
        title="Barre latérale compacte"
        description="Afficher uniquement les icônes de navigation."
        checked={prefs.sidebarCollapsed}
        onToggle={(value) => onPrefsChange({ sidebarCollapsed: value })}
      />
    </>
  );
}
