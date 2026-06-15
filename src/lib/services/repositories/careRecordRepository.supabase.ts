import { createTenantTableRepository, type TenantTableRow } from './createTenantTableRepository';

export type CareRecordRow = TenantTableRow;

/** WP290 — Live Supabase Repository (careRecords) */
export const careRecordSupabaseRepository = createTenantTableRepository({
  wpNumber: 290,
  table: 'care_records',
  entityLabel: 'Pflegedokumentation',
});
