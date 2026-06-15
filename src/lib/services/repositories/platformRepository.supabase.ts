import { createTenantTableRepository, type TenantTableRow } from './createTenantTableRepository';

export type PlatformRow = TenantTableRow;

/** WP470 — Live Supabase Repository (platform) */
export const platformSupabaseRepository = createTenantTableRepository({
  wpNumber: 470,
  table: 'ocr_jobs',
  entityLabel: 'OCR-Job',
});
