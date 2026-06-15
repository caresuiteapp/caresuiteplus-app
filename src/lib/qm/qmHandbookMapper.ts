import type { ServiceResult } from '@/types';
import type { QmHandbook } from './qm.types';

/** Spalten aus Migration 0015 — QM-Handbuch-Stammdaten. */
export const HANDBOOK_LIVE_SELECT_COLUMNS =
  'id, tenant_id, title, version, status, approved_at, approved_by, created_at, updated_at';

export type QmHandbookLiveRow = {
  id: string;
  tenant_id: string;
  title: string;
  version: string;
  status: string;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
};

export function mapHandbookRow(row: QmHandbookLiveRow): QmHandbook {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    title: row.title.trim(),
    version: row.version.trim(),
    status: row.status as QmHandbook['status'],
    approvedAt: row.approved_at,
    approvedBy: row.approved_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapHandbookRowToDetail(
  row: QmHandbookLiveRow | null,
): ServiceResult<QmHandbook> {
  if (!row) {
    return { ok: false, error: 'QM-Handbuch nicht gefunden.' };
  }
  if (!row.title?.trim()) {
    return { ok: false, error: 'Live-QM-Handbuch: Titel fehlt in Supabase.' };
  }
  return { ok: true, data: mapHandbookRow(row) };
}
