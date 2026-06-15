import { createTenantTableRepository } from './createTenantTableRepository';

/** WP130 — Live Supabase Repository (Business) */
export const businessSupabaseRepository = createTenantTableRepository({
  wpNumber: 130,
  table: 'tenant_subscriptions',
  entityLabel: 'Business',
});
