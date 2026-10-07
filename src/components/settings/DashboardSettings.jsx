import React from 'react';
import SettingRow from '../ui/SettingRow';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { DASHBOARD_BLOCKS, DEFAULT_DASHBOARD } from '../../services/dashboardPrefs';

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


export default function DashboardSettings({ config, changeDashboard, moveBlock }) {
  return (
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
  );
}
