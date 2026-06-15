import { createTenantTableRepository, type TenantTableRow } from './createTenantTableRepository';

export type CatalogRow = TenantTableRow;

/** WP450 — Live Supabase Repository (catalog) */
export const catalogSupabaseRepository = createTenantTableRepository({
  wpNumber: 450,
  table: 'catalogs',
  entityLabel: 'Katalog',
});
