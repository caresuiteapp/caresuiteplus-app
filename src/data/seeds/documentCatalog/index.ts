import { buildAllCatalogTemplates } from './builders';
import { SYSTEM_DOCUMENT_CATALOG_MANIFEST } from './manifestEntries';

export const SYSTEM_DOCUMENT_CATALOG_TEMPLATES = buildAllCatalogTemplates(SYSTEM_DOCUMENT_CATALOG_MANIFEST);

export { SYSTEM_DOCUMENT_CATALOG_MANIFEST, getAssistAllowedCatalogEntries, getCatalogEntryByKey } from './manifestEntries';
export { buildCatalogTemplate, buildAllCatalogTemplates } from './builders';
export type { DocumentCatalogEntry, BuiltDocumentCatalogTemplate, DocumentLayoutKind } from './types';

export function getSystemDocumentCatalogCount(): number {
  return SYSTEM_DOCUMENT_CATALOG_TEMPLATES.length;
}
