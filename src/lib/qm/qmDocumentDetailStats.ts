import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';
import type { QmDocument, QmDocumentVersion } from './qm.types';

export type QmDocumentDetailKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

function formatShortDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

const TYPE_LABELS: Record<string, string> = {
  procedure: 'Verfahren',
  work_instruction: 'Arbeitsanweisung',
  checklist: 'Checkliste',
  protocol: 'Protokoll',
  policy: 'Richtlinie',
  form: 'Formular',
  handbook_chapter: 'Handbuch-Kapitel',
};

export function buildQmDocumentDetailKpis(document: QmDocument,
  currentVersion: QmDocumentVersion | undefined,
  versionCount: number,
  confirmationCount: number, mode: ColorMode = 'dark'): QmDocumentDetailKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  return [
    {
      id: 'number',
      label: 'Dok.-Nr.',
      value: document.documentNumber,
      subValue: TYPE_LABELS[document.documentType] ?? document.documentType,
      icon: '📋',
      accentColor: colors.cyan,
    },
    {
      id: 'version',
      label: 'Version',
      value: currentVersion?.versionNumber ?? '—',
      subValue: versionCount === 1 ? '1 Version' : `${versionCount} Versionen`,
      icon: '🔢',
      accentColor: colors.violet,
    },
    {
      id: 'review',
      label: 'Prüfung fällig',
      value: formatShortDate(document.reviewDueAt),
      subValue: document.ownerRole ? `Verantw.: ${document.ownerRole}` : undefined,
      icon: '📆',
      accentColor: colors.orange,
    },
    {
      id: 'confirmations',
      label: 'Lesebest.',
      value: String(confirmationCount),
      subValue: confirmationCount === 1 ? 'Bestätigung' : 'Bestätigungen',
      icon: '✅',
      accentColor: colors.success,
    },
  ];
}
