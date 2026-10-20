import type { IntegrationProviderListItem } from '@/types/modules/integrations';
import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';

export type IntegrationListKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

export function buildIntegrationListKpis(items: IntegrationProviderListItem[], mode: ColorMode = 'dark'): IntegrationListKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  const activeCount = items.filter((item) => item.status === 'active').length;
  const pendingCount = items.filter((item) => item.status === 'pending_setup').length;
  const errorCount = items.filter((item) => item.status === 'error').length;
  const categories = new Set(items.map((item) => item.category));

  return [
    {
      id: 'total',
      label: 'Anbieter',
      value: String(items.length),
      subValue: `${categories.size} Kategorien`,
      icon: '🔌',
      accentColor: colors.cyan,
    },
    {
      id: 'active',
      label: 'Aktiv',
      value: String(activeCount),
      icon: '✅',
      accentColor: colors.success,
    },
    {
      id: 'pending',
      label: 'Einrichtung',
      value: String(pendingCount),
      icon: '⏳',
      accentColor: colors.orange,
    },
    {
      id: 'errors',
      label: 'Fehler',
      value: String(errorCount),
      icon: '⚠️',
      accentColor: errorCount > 0 ? colors.error : colors.textMuted,
    },
  ];
}
