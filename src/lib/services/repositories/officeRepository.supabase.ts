import { createTenantTableRepository } from './createTenantTableRepository';

/** WP150 — Live Supabase Repository (Office) */
export const officeSupabaseRepository = createTenantTableRepository({
  wpNumber: 150,
  table: 'appointments',
  entityLabel: 'Office',
});
