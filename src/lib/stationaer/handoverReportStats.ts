import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';
import type { HandoverReportListItem } from '@/types/modules/stationaer';

export type HandoverReportListKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

export function buildHandoverReportListKpis(items: HandoverReportListItem[], mode: ColorMode = 'dark'): HandoverReportListKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  const thisWeek = items.filter((item) => {
    const diff = Date.now() - new Date(item.handoverAt).getTime();
    return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
  }).length;
  const wings = new Set(items.map((item) => item.wing ?? 'Haus')).size;

  return [
    {
      id: 'total',
      label: 'Berichte',
      value: String(items.length),
      subValue: `${thisWeek} diese Woche`,
      icon: '📋',
      accentColor: colors.amber,
    },
    {
      id: 'wings',
      label: 'Bereiche',
      value: String(wings),
      subValue: 'Mit Übergaben',
      icon: '🏢',
      accentColor: colors.violet,
    },
    {
      id: 'latest',
      label: 'Letzte',
      value: items[0]
        ? new Date(items[0].handoverAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
        : '—',
      subValue: items[0]?.shiftLabel ?? 'Keine Übergabe',
      icon: '🕐',
      accentColor: colors.cyan,
    },
  ];
}
