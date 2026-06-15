import type { CareRecordListItem } from '@/types/modules/assist';
import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';

export type CareRecordsListKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

export function buildCareRecordsListKpis(items: CareRecordListItem[],
  totalCount: number, mode: ColorMode = 'dark'): CareRecordsListKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  const signed = items.filter((i) => i.hasSignature).length;
  const pdfReady = items.filter((i) => i.pdfReady).length;
  const open = items.filter((i) => i.status === 'aktiv' || i.status === 'in_bearbeitung').length;

  return [
    {
      id: 'total',
      label: 'Nachweise',
      value: String(totalCount),
      icon: '📝',
      accentColor: colors.amber,
    },
    {
      id: 'signed',
      label: 'Signiert',
      value: String(signed),
      subValue: signed < totalCount ? `${totalCount - signed} ohne Signatur` : 'Alle signiert',
      icon: '✍️',
      accentColor: signed === totalCount && totalCount > 0 ? colors.success : colors.orange,
    },
    {
      id: 'pdf',
      label: 'PDF bereit',
      value: String(pdfReady),
      subValue: open > 0 ? `${open} offen` : undefined,
      icon: '📄',
      accentColor: colors.cyan,
    },
  ];
}
