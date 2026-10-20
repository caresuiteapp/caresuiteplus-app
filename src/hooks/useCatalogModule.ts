import { fetchCatalogModuleSnapshot } from '@/lib/catalog/catalogModuleService';
import { useTenantModuleSnapshot } from '@/hooks/core/useTenantModuleSnapshot';

/** WP448 — Catalog Modul-Hook */
export function useCatalogModule() {
  return useTenantModuleSnapshot(448, fetchCatalogModuleSnapshot);
}
