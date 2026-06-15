import type { HandoverDetail } from '@/types/modules/stationaer';
import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';

export type HandoverDetailKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

export function buildHandoverDetailKpis(handover: HandoverDetail, mode: ColorMode = 'dark'): HandoverDetailKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  const handoverDate = new Date(handover.handoverAt).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  return [
    {
      id: 'shift',
      label: 'Schicht',
      value: handover.shiftLabel,
      subValue: handover.wing ?? 'Haus',
      icon: '🕐',
      accentColor: colors.amber,
    },
    {
      id: 'author',
      label: 'Autor:in',
      value: handover.authorName.split(' ')[0] ?? handover.authorName,
      subValue: handover.authorName,
      icon: '👤',
      accentColor: colors.violet,
    },
    {
      id: 'time',
      label: 'Übergabe',
      value: handoverDate,
      subValue: handover.priorityLabel,
      icon: '📝',
      accentColor: colors.cyan,
    },
  ];
}
