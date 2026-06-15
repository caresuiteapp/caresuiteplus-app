import type { CareDocumentationDetail, CareDocumentationListItem } from './careDocumentationTypes';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';

export type CareDocumentationListKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

export function buildCareDocumentationListKpis(items: CareDocumentationListItem[], mode: ColorMode = 'dark'): CareDocumentationListKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  const signed = items.filter((item) => item.hasSignature).length;
  const open = items.filter((item) => item.status === 'in_bearbeitung').length;
  const pdfReady = items.filter((item) => item.pdfReady).length;

  return [
    {
      id: 'total',
      label: 'Nachweise',
      value: String(items.length),
      subValue: items.length === 1 ? 'Eintrag' : 'Einträge',
      icon: '📝',
      accentColor: colors.cyan,
    },
    {
      id: 'signed',
      label: 'Signiert',
      value: String(signed),
      subValue: `${open} offen`,
      icon: '✍️',
      accentColor: colors.success,
    },
    {
      id: 'pdf',
      label: 'PDF bereit',
      value: String(pdfReady),
      subValue: pdfReady > 0 ? 'Export möglich' : 'Noch keine PDFs',
      icon: '📄',
      accentColor: pdfReady > 0 ? colors.violet : colors.textMuted,
    },
  ];
}

export function buildCareDocumentationDetailKpis(detail: CareDocumentationDetail, mode: ColorMode = 'dark'): CareDocumentationListKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  return [
    {
      id: 'status',
      label: 'Status',
      value: WORKFLOW_STATUS_LABELS[detail.status],
      subValue: detail.recordedAt
        ? new Date(detail.recordedAt).toLocaleDateString('de-DE')
        : undefined,
      icon: '📝',
      accentColor: colors.cyan,
    },
    {
      id: 'signed',
      label: 'Signatur',
      value: detail.hasSignature ? 'Signiert' : 'Ausstehend',
      subValue: detail.hasSignature ? 'Assist-Pfad' : 'Demo-funktional',
      icon: '✍️',
      accentColor: detail.hasSignature ? colors.success : colors.amber,
    },
    {
      id: 'pdf',
      label: 'PDF',
      value: detail.pdfReady ? 'Bereit' : 'Ausstehend',
      subValue: detail.pdfReady ? 'Export vorbereitet' : 'Demo-funktional',
      icon: '📄',
      accentColor: detail.pdfReady ? colors.violet : colors.textMuted,
    },
  ];
}
