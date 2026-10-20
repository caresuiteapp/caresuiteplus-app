import type { SecurityListItem } from '@/types/security';
import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';

export type SecurityListKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

export function buildSecurityListKpis(items: SecurityListItem[], mode: ColorMode = 'dark'): SecurityListKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  const critical = items.filter((item) => item.severity === 'critical').length;
  const open = items.filter((item) => item.status !== 'archiviert').length;

  return [
    {
      id: 'total',
      label: 'Findings',
      value: String(items.length),
      subValue: `${open} offen`,
      icon: '🛡️',
      accentColor: colors.orange,
    },
    {
      id: 'critical',
      label: 'Kritisch',
      value: String(critical),
      icon: '🚨',
      accentColor: critical > 0 ? colors.error : colors.textMuted,
    },
    {
      id: 'dsgvo',
      label: 'DSGVO',
      value: String(items.filter((item) => item.category === 'dsgvo').length),
      subValue: 'Kategorie',
      icon: '📋',
      accentColor: colors.cyan,
    },
  ];
}
