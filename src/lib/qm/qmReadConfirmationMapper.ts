import type { ServiceResult } from '@/types';
import type { QmReadConfirmation } from './qm.types';

/** Spalten aus Migration 0015 — Lesebestätigungen. */
export const READ_CONFIRMATION_LIVE_SELECT_COLUMNS =
  'id, tenant_id, document_id, document_version_id, user_id, user_display_name, confirmed_at, created_at, updated_at';

export type QmReadConfirmationLiveRow = {
  id: string;
  tenant_id: string;
  document_id: string;
  document_version_id: string;
  user_id: string;
  user_display_name: string;
  confirmed_at: string;
  created_at: string;
  updated_at: string;
};

export function mapReadConfirmationRow(row: QmReadConfirmationLiveRow): QmReadConfirmation {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    documentId: row.document_id,
    documentVersionId: row.document_version_id,
    userId: row.user_id.trim(),
    userDisplayName: row.user_display_name.trim() || row.user_id.trim(),
    confirmedAt: row.confirmed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapReadConfirmationRowsToList(
  rows: QmReadConfirmationLiveRow[],
): ServiceResult<QmReadConfirmation[]> {
  if (rows.length === 0) {
    return { ok: true, data: [] };
  }

  const schemaMissing = new Set<string>();
  for (const row of rows) {
    if (row.document_id === undefined) schemaMissing.add('document_id');
    if (row.document_version_id === undefined) schemaMissing.add('document_version_id');
    if (row.user_id === undefined) schemaMissing.add('user_id');
    if (row.confirmed_at === undefined) schemaMissing.add('confirmed_at');
  }
  if (schemaMissing.size > 0) {
    const fields = [...schemaMissing].sort().join(', ');
    return {
      ok: false,
      error: `Live-QM-Lesebestätigungen: Supabase-Schema unvollständig (${fields} fehlen). Migration 0015 prüfen.`,
    };
  }

  return {
    ok: true,
    data: rows.map(mapReadConfirmationRow),
  };
}
