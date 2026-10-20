import { createTenantTableRepository } from './createTenantTableRepository';

/** WP370 — Live Supabase Repository (Pflege) */
export const pflegeSupabaseRepository = createTenantTableRepository({
  wpNumber: 370,
  table: 'care_records',
  entityLabel: 'Pflege',
});
