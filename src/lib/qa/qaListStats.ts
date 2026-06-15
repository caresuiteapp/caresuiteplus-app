import type { QaListItem } from '@/types/qa';
import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';

export type QaListKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

export function buildQaListKpis(items: QaListItem[], mode: ColorMode = 'dark'): QaListKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  const bugs = items.filter((item) => item.kind === 'bug').length;
  const open = items.filter((item) => item.status !== 'archiviert').length;

  return [
    {
      id: 'total',
      label: 'QA-Items',
      value: String(items.length),
      subValue: `${open} offen`,
      icon: '🧪',
      accentColor: colors.cyan,
    },
    {
      id: 'bugs',
      label: 'Bugs',
      value: String(bugs),
      icon: '🐛',
      accentColor: bugs > 0 ? colors.warning : colors.textMuted,
    },
    {
      id: 'pilot',
      label: 'Pilot',
      value: String(items.filter((item) => item.kind === 'pilot').length),
      subValue: 'Checklisten',
      icon: '🚀',
      accentColor: colors.violet,
    },
  ];
}
