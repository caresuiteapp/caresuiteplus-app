import { createTenantTableRepository } from './createTenantTableRepository';

/** WP330 — Live Supabase Repository (EmployeePortal) */
export const employeePortalSupabaseRepository = createTenantTableRepository({
  wpNumber: 330,
  table: 'assignments',
  entityLabel: 'EmployeePortal',
});
