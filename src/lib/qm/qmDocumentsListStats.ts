import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';
import type { QmDocument } from '@/lib/qm/qm.types';

export type QmDocumentsListKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

const STATUS_GROUPS = {
  published: ['published', 'approved'],
  review: ['draft', 'in_review'],
  archived: ['archived', 'superseded'],
};

export function buildQmDocumentsListKpis(documents: QmDocument[], mode: ColorMode = 'dark'): QmDocumentsListKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  const published = documents.filter((doc) => STATUS_GROUPS.published.includes(doc.status)).length;
  const inReview = documents.filter((doc) => STATUS_GROUPS.review.includes(doc.status)).length;
  const overdueReview = documents.filter((doc) => {
    if (!doc.reviewDueAt) return false;
    return new Date(doc.reviewDueAt).getTime() < Date.now();
  }).length;

  return [
    {
      id: 'total',
      label: 'Dokumente',
      value: String(documents.length),
      subValue: `${published} freigegeben`,
      icon: '📄',
      accentColor: colors.cyan,
    },
    {
      id: 'review',
      label: 'In Prüfung',
      value: String(inReview),
      subValue: `${overdueReview} überfällig`,
      icon: '📋',
      accentColor: colors.orange,
    },
    {
      id: 'types',
      label: 'Typen',
      value: String(new Set(documents.map((doc) => doc.documentType)).size),
      subValue: 'Verschiedene',
      icon: '🗂️',
      accentColor: colors.violet,
    },
  ];
}
