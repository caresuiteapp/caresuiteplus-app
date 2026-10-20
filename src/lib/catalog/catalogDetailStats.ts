import type { CatalogDetail } from '@/types/modules/catalog';
import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';

export type CatalogDetailKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

export function buildCatalogDetailKpis(catalog: CatalogDetail, itemCount: number, mode: ColorMode = 'dark'): CatalogDetailKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  return [
    {
      id: 'positions',
      label: 'Positionen',
      value: String(itemCount),
      subValue: `${catalog.itemCount} im Index`,
      icon: '📦',
      accentColor: colors.orange,
    },
    {
      id: 'usage',
      label: 'Verwendungen',
      value: String(catalog.usageCount),
      icon: '🔗',
      accentColor: colors.cyan,
    },
    {
      id: 'status',
      label: 'Status',
      value: catalog.status === 'aktiv' ? 'Aktiv' : catalog.status,
      icon: '📋',
      accentColor: colors.success,
    },
    {
      id: 'updated',
      label: 'Aktualisiert',
      value: new Date(catalog.updatedAt).toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
      }),
      subValue: new Date(catalog.updatedAt).toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      icon: '🕐',
      accentColor: colors.violet,
    },
  ];
}
