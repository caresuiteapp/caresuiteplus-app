import { createTenantTableRepository } from './createTenantTableRepository';

/** WP350 — Live Supabase Repository (ClientPortal) */
export const clientPortalSupabaseRepository = createTenantTableRepository({
  wpNumber: 350,
  table: 'trips',
  entityLabel: 'ClientPortal',
});
