export const DASHBOARD_BLOCKS = [
  {
    id: 'stats',
    label: 'Statistiques',
    description: 'Projets, serveurs actifs, processeur et mémoire.',
  },
  {
    id: 'cpu',
    label: 'Graphique processeur',
    description: 'Évolution de la consommation CPU.',
  },
  {
    id: 'ram',
    label: 'Graphique mémoire',
    description: 'Évolution de la mémoire utilisée.',
  },
  {
    id: 'servers',
    label: 'Serveurs',
    description: 'État des serveurs et actions rapides.',
  },
];
export const DEFAULT_DASHBOARD = {
  blocks: ['stats', 'cpu', 'ram', 'servers'],
  hidden: [],
  chartStyle: 'area',
  period: 300,
  scope: 'projects',
  compact: false,
};
export function dashboardPrefs(value) {
  const input = value && typeof value === 'object' ? value : {};
  const ids = DASHBOARD_BLOCKS.map((block) => block.id);
  const blocks = Array.isArray(input.blocks) ? input.blocks.filter((id) => ids.includes(id)) : [];
  return {
    ...DEFAULT_DASHBOARD,
    blocks: [...new Set([...blocks, ...ids])],
    hidden: Array.isArray(input.hidden) ? [...new Set(input.hidden.filter((id) => ids.includes(id)))] : [],
    chartStyle: ['area', 'line', 'bars'].includes(input.chartStyle) ? input.chartStyle : 'area',
    period: [60, 300, 900].includes(input.period) ? input.period : 300,
    scope: input.scope === 'system' ? 'system' : 'projects',
    compact: input.compact === true,
  };
}
