import type { CareRecordDetail } from '@/types/modules/assist';
import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';

export type CareRecordDetailKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

export function buildCareRecordDetailKpis(record: CareRecordDetail, mode: ColorMode = 'dark'): CareRecordDetailKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  const recordedDate = new Date(record.recordedAt).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  return [
    {
      id: 'client',
      label: 'Klient:in',
      value: record.clientName.split(' ')[0] ?? record.clientName,
      subValue: record.clientName,
      icon: '👤',
      accentColor: colors.cyan,
    },
    {
      id: 'duration',
      label: 'Dauer',
      value: record.durationMinutes != null ? `${record.durationMinutes} Min.` : '—',
      subValue: record.location ?? 'Ort nicht hinterlegt',
      icon: '⏱️',
      accentColor: colors.amber,
    },
    {
      id: 'recorded',
      label: 'Erfasst',
      value: recordedDate,
      subValue: record.hasSignature ? 'Signiert' : 'Signatur ausstehend',
      icon: record.hasSignature ? '✍️' : '📝',
      accentColor: record.hasSignature ? colors.success : colors.orange,
    },
  ];
}
