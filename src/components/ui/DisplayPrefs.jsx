import React from 'react';
import { Sun, Moon, MonitorSmartphone, Type, Zap } from 'lucide-react';
import { THEMES, TEXT_SIZES } from '../../services/prefs';

const THEME_ICONS = { system: MonitorSmartphone, dark: Moon, light: Sun };

function Segmented({ label, value, options, onChange, renderOption }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.id)}
            className={`min-h-11 rounded-xl border px-3 py-2 text-[13px] flex items-center justify-center gap-2 transition-colors cursor-pointer ${
              active
                ? 'theme-accent-active font-medium'
                : 'border-[var(--line)] text-zinc-400 hover:text-zinc-100 hover:border-[var(--line-strong)]'
            }`}
          >
            {renderOption ? renderOption(opt) : opt.label}
          </button>
        );
      })}
    </div>
  );
}

/** Réglages d'affichage : thème, taille du texte, animations. Effet immédiat. */
export default function DisplayPrefs({ prefs, onChange }) {
  return (
    <section className="space-y-6" aria-labelledby="display-prefs-title">
      <div>
        <h3 id="display-prefs-title" className="text-sm font-semibold text-zinc-50">Affichage</h3>
        <p className="text-xs text-zinc-400 mt-1">Adaptez Sprint à votre confort. Les changements s’appliquent tout de suite.</p>
      </div>

      <div className="space-y-2">
        <div className="text-[13px] font-medium text-zinc-200">Thème</div>
        <Segmented
          label="Thème"
          value={prefs.theme}
          options={THEMES}
          onChange={(theme) => onChange({ theme })}
          renderOption={(opt) => {
            const Icon = THEME_ICONS[opt.id];
            return (
              <>
                <Icon className="w-4 h-4" />
                {opt.label}
              </>
            );
          }}
        />
        <p className="text-[11px] text-zinc-500">« Automatique » suit le réglage clair ou sombre de Windows.</p>
      </div>

      <div className="space-y-2">
        <div className="text-[13px] font-medium text-zinc-200 flex items-center gap-2">
          <Type className="w-4 h-4 text-zinc-500" /> Taille du texte
        </div>
        <Segmented
          label="Taille du texte"
          value={prefs.textSize}
          options={TEXT_SIZES}
          onChange={(textSize) => onChange({ textSize })}
        />
      </div>

      <div className="space-y-2">
        <div className="text-[13px] font-medium text-zinc-200 flex items-center gap-2">
          <Zap className="w-4 h-4 text-zinc-500" /> Animations
        </div>
        <Segmented
          label="Animations"
          value={prefs.reduceMotion}
          options={[
            { id: 'system', label: 'Comme Windows' },
            { id: 'off', label: 'Activées' },
            { id: 'on', label: 'Réduites' },
          ]}
          onChange={(reduceMotion) => onChange({ reduceMotion })}
        />
        <p className="text-[11px] text-zinc-500">Réduire les animations aide en cas de gêne visuelle ou d’ordinateur lent.</p>
      </div>
    </section>
  );
}
