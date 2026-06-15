import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';

export type PortalAnnouncementsKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

export function buildPortalAnnouncementsKpis(itemCount: number,
  activeCount: number, mode: ColorMode = 'dark'): PortalAnnouncementsKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  return [
    {
      id: 'total',
      label: 'Einträge',
      value: String(itemCount),
      icon: '📢',
      accentColor: colors.orange,
    },
    {
      id: 'active',
      label: 'Aktiv',
      value: String(activeCount),
      subValue: activeCount > 0 ? 'Sichtbar im Portal' : 'Keine aktiven',
      icon: '✅',
      accentColor: activeCount > 0 ? colors.success : colors.textMuted,
    },
  ];
}
