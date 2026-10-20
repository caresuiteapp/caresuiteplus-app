import type { OutboxEntryListItem } from '@/types/modules/integrations';
import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';

export type OutboxListKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

export function buildOutboxListKpis(items: OutboxEntryListItem[], mode: ColorMode = 'dark'): OutboxListKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  const pending = items.filter((item) => item.status === 'pending').length;
  const failed = items.filter((item) => item.status === 'failed').length;
  const sent = items.filter((item) => item.status === 'sent').length;

  return [
    {
      id: 'total',
      label: 'Einträge',
      value: String(items.length),
      icon: '📤',
      accentColor: colors.cyan,
    },
    {
      id: 'pending',
      label: 'Ausstehend',
      value: String(pending),
      icon: '⏳',
      accentColor: colors.orange,
    },
    {
      id: 'failed',
      label: 'Fehlgeschlagen',
      value: String(failed),
      icon: '⚠️',
      accentColor: failed > 0 ? colors.error : colors.textMuted,
    },
    {
      id: 'sent',
      label: 'Gesendet',
      value: String(sent),
      icon: '✅',
      accentColor: colors.success,
    },
  ];
}
