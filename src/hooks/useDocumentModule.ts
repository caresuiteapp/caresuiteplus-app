import { fetchDocumentModuleSnapshot } from '@/lib/office/officeDocsModuleService';
import { useTenantModuleSnapshot } from '@/hooks/core/useTenantModuleSnapshot';

/** WP208 — Document Modul-Hook */
export function useDocumentModule() {
  return useTenantModuleSnapshot(208, fetchDocumentModuleSnapshot);
}
