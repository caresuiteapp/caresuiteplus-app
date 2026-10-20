import { createTenantTableRepository, type TenantTableRow } from './createTenantTableRepository';

export type AssignmentRow = TenantTableRow;

/** WP250 — Live Supabase Repository (assistPlanning) */
export const assignmentSupabaseRepository = createTenantTableRepository({
  wpNumber: 250,
  table: 'assignments',
  entityLabel: 'Einsatz',
});
