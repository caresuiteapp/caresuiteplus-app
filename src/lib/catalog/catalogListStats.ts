import type { CatalogListItem } from '@/types/modules/catalog';
import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';

export type CatalogListKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

export function buildCatalogListKpis(items: CatalogListItem[], mode: ColorMode = 'dark'): CatalogListKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  const activeCount = items.filter((item) => item.status === 'aktiv').length;
  const totalPositions = items.reduce((sum, item) => sum + item.itemCount, 0);
  const types = new Set(items.map((item) => item.catalogType));

  return [
    {
      id: 'total',
      label: 'Kataloge',
      value: String(items.length),
      subValue: `${types.size} Typen`,
      icon: '📋',
      accentColor: colors.orange,
    },
    {
      id: 'active',
      label: 'Aktiv',
      value: String(activeCount),
      icon: '✅',
      accentColor: colors.success,
    },
    {
      id: 'positions',
      label: 'Positionen',
      value: String(totalPositions),
      subValue: 'Gesamt',
      icon: '📦',
      accentColor: colors.cyan,
    },
    {
      id: 'draft',
      label: 'In Bearbeitung',
      value: String(items.filter((item) => item.status === 'in_bearbeitung').length),
      icon: '⏳',
      accentColor: colors.orange,
    },
  ];
}
