import type { ClientListItem } from '@/types/modules/office';
import { formatCareLevel, normalizeCareLevelKey } from '@/lib/formatters/unitFormatters';

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
      icon: '👥',
      accentColor: '#62F3FF',
    },
    {
      id: 'clients-kpi-active',
      label: 'Aktiv',
      value: active,
      subValue: active > 0 ? 'In Betreuung' : 'Keine aktiven',
      icon: '✅',
      accentColor: '#22C55E',
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
  { key: 'pg1', label: formatCareLevel('pg1') },
  { key: 'pg2', label: formatCareLevel('pg2') },
  { key: 'pg3', label: formatCareLevel('pg3') },
  { key: 'pg4', label: formatCareLevel('pg4') },
  { key: 'pg5', label: formatCareLevel('pg5') },
  { key: 'none', label: 'Ohne PG' },
] as const;

export type ClientCareLevelFilterKey = (typeof CLIENT_CARE_LEVEL_FILTERS)[number]['key'];

export function filterClientsByCareLevel(
  items: ClientListItem[],
  careLevelFilter: ClientCareLevelFilterKey,
): ClientListItem[] {
  if (careLevelFilter === 'all') return items;
  if (careLevelFilter === 'none') return items.filter((c) => !c.careLevel);
  const filterKey = normalizeCareLevelKey(careLevelFilter);
  return items.filter((c) => normalizeCareLevelKey(c.careLevel) === filterKey);
}
