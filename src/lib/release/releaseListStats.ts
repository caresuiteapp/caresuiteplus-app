import type { ReleaseListItem } from '@/types/release';
import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';

export type ReleaseListKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

export function buildReleaseListKpis(items: ReleaseListItem[], mode: ColorMode = 'dark'): ReleaseListKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  const total = items.length;
  const inProgress = items.filter((i) => i.status === 'in_bearbeitung').length;
  const checklistDone = items.reduce((sum, i) => sum + i.checklistDone, 0);
  const checklistTotal = items.reduce((sum, i) => sum + i.checklistTotal, 0);
  const completionPercent =
    checklistTotal > 0 ? Math.round((checklistDone / checklistTotal) * 100) : 0;

  return [
    {
      id: 'total',
      label: 'Releases',
      value: String(total),
      subValue: total === 1 ? 'Paket' : 'Pakete',
      icon: '🚀',
      accentColor: colors.cyan,
    },
    {
      id: 'in-progress',
      label: 'In Bearbeitung',
      value: String(inProgress),
      icon: '⏳',
      accentColor: inProgress > 0 ? colors.orange : colors.textMuted,
    },
    {
      id: 'checklist',
      label: 'Checkliste',
      value: `${completionPercent} %`,
      subValue: `${checklistDone}/${checklistTotal}`,
      icon: '✅',
      accentColor:
        completionPercent >= 80 ? colors.success : completionPercent >= 50 ? colors.orange : colors.textMuted,
    },
  ];
}
