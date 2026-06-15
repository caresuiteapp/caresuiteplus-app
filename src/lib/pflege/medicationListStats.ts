import type { MedicationListItem } from '@/data/demo/medications';
import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';

export type MedicationListKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

export function buildMedicationListKpis(items: MedicationListItem[], mode: ColorMode = 'dark'): MedicationListKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  const active = items.filter((item) => item.status === 'aktiv').length;
  const clients = new Set(items.map((item) => item.clientId)).size;
  const prn = items.filter((item) => item.schedule.toLowerCase().includes('bedarf')).length;

  return [
    {
      id: 'total',
      label: 'Verordnungen',
      value: String(items.length),
      subValue: items.length === 1 ? 'Eintrag' : 'Einträge',
      icon: '💊',
      accentColor: colors.cyan,
    },
    {
      id: 'active',
      label: 'Aktiv',
      value: String(active),
      subValue: `${clients} Klient:innen`,
      icon: '✅',
      accentColor: colors.success,
    },
    {
      id: 'prn',
      label: 'Bedarfsmedikation',
      value: String(prn),
      subValue: prn > 0 ? 'PRN-Verordnungen' : 'Keine PRN',
      icon: '🕐',
      accentColor: prn > 0 ? colors.orange : colors.textMuted,
    },
  ];
}
