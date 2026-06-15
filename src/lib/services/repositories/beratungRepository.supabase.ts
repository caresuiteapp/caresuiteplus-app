import { createTenantTableRepository } from './createTenantTableRepository';

/** WP410 — Live Supabase Repository (Beratung) */
export const beratungSupabaseRepository = createTenantTableRepository({
  wpNumber: 410,
  table: 'appointments',
  entityLabel: 'Beratung',
});
