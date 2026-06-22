import type { MessageListItem } from '@/types/portal/communication';
import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';

export type OfficeMessageListKpi = {
  id: string;
  label: string;
  value: number;
  subValue?: string;
  icon: string;
  accentColor: string;
};

export function buildOfficeMessageListKpis(
  items: MessageListItem[],
  mode: ColorMode = 'dark',
): OfficeMessageListKpi[] {
  const colors = legacyColorsFromPalette(mode);
  const unread = items.filter((m) => !m.readAt).length;
  const active = items.filter((m) => m.status === 'aktiv' || m.status === 'in_bearbeitung').length;
  const errors = items.filter((m) => m.status === 'fehlerhaft').length;

  return [
    {
      id: 'messages-kpi-unread',
      label: 'Ungelesen',
      value: unread,
      subValue: unread > 0 ? 'Posteingang prüfen' : 'Alles gelesen',
      icon: '📬',
      accentColor: colors.orange,
    },
    {
      id: 'messages-kpi-active',
      label: 'Aktiv',
      value: active,
      subValue: `${items.length} gesamt`,
      icon: '💬',
      accentColor: colors.success,
    },
    {
      id: 'messages-kpi-errors',
      label: 'Fehlerhaft',
      value: errors,
      subValue: errors > 0 ? 'Bearbeitung nötig' : 'Keine Fehler',
      icon: '⚠️',
      accentColor: colors.danger,
    },
  ];
}
