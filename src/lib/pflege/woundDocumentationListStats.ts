import type { WoundDocumentation } from '@/types/modules/pflege';
import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';

export type WoundDocumentationListKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

export function buildWoundDocumentationListKpis(items: WoundDocumentation[], mode: ColorMode = 'dark'): WoundDocumentationListKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  const open = items.filter(
    (item) => item.status === 'aktiv' || item.status === 'in_bearbeitung',
  ).length;
  const active = items.filter((item) => item.status === 'aktiv').length;
  const clients = new Set(items.map((item) => item.clientId)).size;

  return [
    {
      id: 'total',
      label: 'Wundfälle',
      value: String(items.length),
      subValue: `${clients} Klient:innen`,
      icon: '🩹',
      accentColor: colors.danger,
    },
    {
      id: 'open',
      label: 'Offen',
      value: String(open),
      subValue: open > 0 ? 'Behandlung läuft' : 'Keine offenen',
      icon: '⚠️',
      accentColor: open > 0 ? colors.orange : colors.textMuted,
    },
    {
      id: 'active',
      label: 'Aktiv',
      value: String(active),
      subValue: 'Dokumentiert',
      icon: '📋',
      accentColor: colors.success,
    },
  ];
}
