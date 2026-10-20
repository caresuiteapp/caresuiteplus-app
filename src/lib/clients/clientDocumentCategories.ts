import { getCatalogOptions, resolveCatalogLabel } from '@/lib/catalogs/systemCatalogService';
import type { ClientDocumentRecord } from '@/types/modules/client';

export const CLIENT_DOCUMENT_ALL_CATEGORY_KEY = 'all';

const LEGACY_CLIENT_CATEGORY_TO_CATALOG: Record<ClientDocumentRecord['category'], string> = {
  vertrag: 'vertrag',
  einwilligung: 'einwilligung',
  pflegeplan: 'pflegebericht',
  arztbrief: 'arztbrief',
  md_gutachten: 'pflegegradbescheid',
  sonstige: 'sonstiges',
};

const INTAKE_DOCUMENT_TYPE_TO_CATALOG: Record<string, string> = {
  privacy_consent: 'datenschutz',
  additional_consent: 'einwilligung',
  client_contract: 'vertrag',
  assignment_declaration: 'vertrag',
};

export type ClientDocumentCategorySummary = {
  key: string;
  label: string;
  count: number;
};

export function resolveClientDocumentCategoryKey(doc: ClientDocumentRecord): string {
  if (doc.documentSource === 'intake' && doc.intakeDocumentType) {
    const mapped = INTAKE_DOCUMENT_TYPE_TO_CATALOG[doc.intakeDocumentType];
    if (mapped) return mapped;
  }

  const rawCategory = String(doc.category);
  if (resolveCatalogLabel('document_category', rawCategory) !== rawCategory) {
    return rawCategory;
  }

  return LEGACY_CLIENT_CATEGORY_TO_CATALOG[doc.category] ?? 'sonstiges';
}

export function getClientDocumentCategoryLabel(categoryKey: string): string {
  if (categoryKey === CLIENT_DOCUMENT_ALL_CATEGORY_KEY) return 'Alle Dokumente';
  return resolveCatalogLabel('document_category', categoryKey);
}

export function filterClientDocumentsByCategory(
  documents: ClientDocumentRecord[],
  categoryKey: string,
): ClientDocumentRecord[] {
  if (categoryKey === CLIENT_DOCUMENT_ALL_CATEGORY_KEY) return documents;
  return documents.filter((doc) => resolveClientDocumentCategoryKey(doc) === categoryKey);
}

export function buildClientDocumentCategoryOverview(
  documents: ClientDocumentRecord[],
): ClientDocumentCategorySummary[] {
  const counts = new Map<string, number>();
  for (const doc of documents) {
    const key = resolveClientDocumentCategoryKey(doc);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return getCatalogOptions('document_category').map((option) => ({
    key: option.value,
    label: option.label,
    count: counts.get(option.value) ?? 0,
  }));
}
