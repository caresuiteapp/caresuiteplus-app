import type { PortalDocumentListItem } from '@/types/portal/documents';
import { PORTAL_DOCUMENT_CATEGORY_LABELS, type PortalDocumentCategory } from '@/types/portal/documents';

export type OfficeDocumentListKpi = {
  id: string;
  label: string;
  value: number;
  subValue?: string;
  icon: string;
  accentColor: string;
};

export const OFFICE_DOCUMENT_CATEGORY_FILTERS = [
  { key: 'all', label: 'Alle Kategorien' },
  { key: 'care_plan', label: PORTAL_DOCUMENT_CATEGORY_LABELS.care_plan },
  { key: 'invoice', label: PORTAL_DOCUMENT_CATEGORY_LABELS.invoice },
  { key: 'report', label: PORTAL_DOCUMENT_CATEGORY_LABELS.report },
  { key: 'consent', label: PORTAL_DOCUMENT_CATEGORY_LABELS.consent },
  { key: 'contract', label: PORTAL_DOCUMENT_CATEGORY_LABELS.contract },
  { key: 'assignment', label: PORTAL_DOCUMENT_CATEGORY_LABELS.assignment },
  { key: 'other', label: PORTAL_DOCUMENT_CATEGORY_LABELS.other },
] as const;

export type OfficeDocumentCategoryFilterKey =
  (typeof OFFICE_DOCUMENT_CATEGORY_FILTERS)[number]['key'];

export function filterOfficeDocumentsByCategory(
  items: PortalDocumentListItem[],
  categoryFilter: OfficeDocumentCategoryFilterKey,
): PortalDocumentListItem[] {
  if (categoryFilter === 'all') return items;
  return items.filter((doc) => doc.category === categoryFilter);
}

export function buildOfficeDocumentListKpis(
  items: PortalDocumentListItem[],
): OfficeDocumentListKpi[] {
  const categories = items.reduce<Record<string, number>>((acc, doc) => {
    acc[doc.category] = (acc[doc.category] ?? 0) + 1;
    return acc;
  }, {});

  const topCategory = Object.entries(categories).sort((a, b) => b[1] - a[1])[0];
  const topLabel = topCategory
    ? PORTAL_DOCUMENT_CATEGORY_LABELS[topCategory[0] as PortalDocumentCategory]
    : undefined;

  const inProgress = items.filter((d) => d.status === 'in_bearbeitung').length;
  const active = items.filter((d) => d.status === 'aktiv').length;

  return [
    {
      id: 'docs-kpi-total',
      label: 'Gesamt',
      value: items.length,
      subValue: `${active} aktiv`,
      icon: '📄',
      accentColor: '#62F3FF',
    },
    {
      id: 'docs-kpi-categories',
      label: 'Kategorien',
      value: Object.keys(categories).length,
      subValue: topLabel ? `Top: ${topLabel}` : 'Keine Daten',
      icon: '🗂️',
      accentColor: '#FF9500',
    },
    {
      id: 'docs-kpi-progress',
      label: 'In Bearbeitung',
      value: inProgress,
      subValue: inProgress > 0 ? 'Freigabe prüfen' : 'Keine offenen',
      icon: '⏳',
      accentColor: '#FFD166',
    },
  ];
}
