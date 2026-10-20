import type { MedicationDetail } from '@/types/modules/pflege';
import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';

export type MedicationDetailKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

export function buildMedicationDetailKpis(detail: MedicationDetail, mode: ColorMode = 'dark'): MedicationDetailKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  const lastAdmin = detail.lastAdministeredAt
    ? new Date(detail.lastAdministeredAt).toLocaleString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  return [
    {
      id: 'dosage',
      label: 'Dosierung',
      value: detail.dosage,
      subValue: detail.schedule,
      icon: '💊',
      accentColor: colors.cyan,
    },
    {
      id: 'route',
      label: 'Applikation',
      value: detail.route,
      subValue: detail.prescribedBy,
      icon: '🩺',
      accentColor: colors.success,
    },
    {
      id: 'last',
      label: 'Letzte Gabe',
      value: lastAdmin,
      subValue: detail.administrations.length > 0 ? `${detail.administrations.length} Dokumentationen` : 'Noch keine Gabe',
      icon: '🕐',
      accentColor: colors.amber,
    },
  ];
}
