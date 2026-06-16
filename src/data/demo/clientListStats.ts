import { formatCareLevel } from '@/lib/formatters/unitFormatters';
import type { ClientListItem } from '@/types/modules/office';

export type ClientListKpi = {
  id: string;
  label: string;
  value: number;
  subValue?: string;
  icon: string;
  accentColor: string;
};

export function buildClientListKpis(items: ClientListItem[]): ClientListKpi[] {
  const active = items.filter((c) => c.status === 'aktiv').length;
  const intake = items.filter((c) => c.status === 'in_bearbeitung').length;
  const drafts = items.filter((c) => c.status === 'entwurf').length;
  const withoutCareLevel = items.filter((c) => !c.careLevel).length;

  return [
    {
      id: 'clients-kpi-total',
      label: 'Gesamt',
      value: items.length,
      subValue: `${active} aktiv`,
      icon: '👥',
      accentColor: '#62F3FF',
    },
    {
      id: 'clients-kpi-intake',
      label: 'In Aufnahme',
      value: intake,
      subValue: intake > 0 ? 'Stammdaten prüfen' : 'Keine offenen',
      icon: '📋',
      accentColor: '#FF9500',
    },
    {
      id: 'clients-kpi-drafts',
      label: 'Entwürfe',
      value: drafts,
      subValue: withoutCareLevel > 0 ? `${withoutCareLevel} ohne PG` : undefined,
      icon: '✏️',
      accentColor: '#FFD166',
    },
  ];
}

export const CLIENT_CARE_LEVEL_FILTERS = [
  { key: 'all', label: 'Alle PG' },
  { key: 'PG 1', label: 'PG 1' },
  { key: 'PG 2', label: 'PG 2' },
  { key: 'PG 3', label: 'PG 3' },
  { key: 'PG 4', label: 'PG 4' },
  { key: 'PG 5', label: 'PG 5' },
  { key: 'none', label: 'Ohne PG' },
] as const;

export type ClientCareLevelFilterKey = (typeof CLIENT_CARE_LEVEL_FILTERS)[number]['key'];

export function filterClientsByCareLevel(
  items: ClientListItem[],
  careLevelFilter: ClientCareLevelFilterKey,
): ClientListItem[] {
  if (careLevelFilter === 'all') return items;
  if (careLevelFilter === 'none') return items.filter((c) => !c.careLevel);
  return items.filter((c) => formatCareLevel(c.careLevel) === careLevelFilter);
}
