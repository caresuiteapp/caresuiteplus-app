import type { KIMMessageListItem } from '@/types/modules/ti';
import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';

export type KIMMailboxListKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

export function buildKIMMailboxListKpis(items: KIMMessageListItem[],
  totalCount: number, mode: ColorMode = 'dark'): KIMMailboxListKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  const unread = items.filter((i) => i.status === 'unread').length;
  const archived = items.filter((i) => i.status === 'archived').length;

  return [
    {
      id: 'total',
      label: 'Nachrichten',
      value: String(totalCount),
      icon: '✉️',
      accentColor: colors.cyan,
    },
    {
      id: 'unread',
      label: 'Ungelesen',
      value: String(unread),
      subValue: unread > 0 ? 'Aktion empfohlen' : 'Postfach gelesen',
      icon: '📬',
      accentColor: unread > 0 ? colors.orange : colors.success,
    },
    {
      id: 'archived',
      label: 'Archiviert',
      value: String(archived),
      icon: '📁',
      accentColor: colors.textMuted,
    },
  ];
}
