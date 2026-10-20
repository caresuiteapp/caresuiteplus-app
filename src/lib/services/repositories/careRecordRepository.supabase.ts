import { createTenantTableRepository, type TenantTableRow } from './createTenantTableRepository';

export type CareRecordRow = TenantTableRow;

/** WP290 — Live Supabase Repository (careRecords) */
export const careRecordSupabaseRepository = createTenantTableRepository({
  wpNumber: 290,
  table: 'care_records',
  entityLabel: 'Pflegedokumentation',
  selectColumns: 'id, tenant_id, title, status, client_name, created_at, updated_at',
});
