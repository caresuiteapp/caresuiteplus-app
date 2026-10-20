import type { ServiceResult } from '@/types';
import type { QmDocument, QmDocumentStatus, QmDocumentType, QmDocumentVersion } from './qm.types';

/** Spalten aus Migration 0015 — vollständiges Dokument-Schema. */
export const DOCUMENT_LIVE_SELECT_COLUMNS =
  'id, tenant_id, document_number, title, document_type, status, current_version_id, chapter_id, owner_role, review_due_at, tags, created_at, updated_at';

/** Spalten aus Migration 0015 — Dokumentversionen. */
export const VERSION_LIVE_SELECT_COLUMNS =
  'id, tenant_id, document_id, version_number, content, change_summary, status, approved_at, approved_by, published_at, created_at, updated_at';

export type QmDocumentLiveRow = {
  id: string;
  tenant_id: string;
  document_number: string;
  title: string;
  document_type: string;
  status: string;
  current_version_id: string | null;
  chapter_id: string | null;
  owner_role: string;
  review_due_at: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
};

export type QmDocumentVersionLiveRow = {
  id: string;
  tenant_id: string;
  document_id: string;
  version_number: string;
  content: string;
  change_summary: string;
  status: string;
  approved_at: string | null;
  approved_by: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export function mapDocumentRow(row: QmDocumentLiveRow): QmDocument {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    documentNumber: row.document_number.trim(),
    title: row.title.trim(),
    documentType: row.document_type as QmDocumentType,
    status: row.status as QmDocumentStatus,
    currentVersionId: row.current_version_id,
    chapterId: row.chapter_id,
    ownerRole: row.owner_role.trim(),
    reviewDueAt: row.review_due_at,
    tags: row.tags ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapDocumentRowsToList(rows: QmDocumentLiveRow[]): ServiceResult<QmDocument[]> {
  if (rows.length === 0) {
    return { ok: true, data: [] };
  }

  const schemaMissing = new Set<string>();
  for (const row of rows) {
    if (row.document_number === undefined) schemaMissing.add('document_number');
    if (row.title === undefined) schemaMissing.add('title');
    if (row.document_type === undefined) schemaMissing.add('document_type');
    if (row.status === undefined) schemaMissing.add('status');
    if (row.owner_role === undefined) schemaMissing.add('owner_role');
  }
  if (schemaMissing.size > 0) {
    const fields = [...schemaMissing].sort().join(', ');
    return {
      ok: false,
      error: `Live-QM-Dokumente: Supabase-Schema unvollständig (${fields} fehlen). Migration 0015 prüfen.`,
    };
  }

  const data = rows.filter((row) => row.title?.trim() && row.document_number?.trim()).map(mapDocumentRow);

  return { ok: true, data };
}

export function mapDocumentRowToDetail(row: QmDocumentLiveRow | null): ServiceResult<QmDocument> {
  if (!row) {
    return { ok: false, error: 'Dokument nicht gefunden.' };
  }
  if (!row.title?.trim()) {
    return { ok: false, error: 'Live-QM-Dokument: Titel fehlt in Supabase.' };
  }
  if (!row.document_number?.trim()) {
    return { ok: false, error: 'Live-QM-Dokument: Dokumentennummer fehlt in Supabase.' };
  }
  return { ok: true, data: mapDocumentRow(row) };
}

export function mapVersionRow(row: QmDocumentVersionLiveRow): QmDocumentVersion {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    documentId: row.document_id,
    versionNumber: row.version_number.trim(),
    content: row.content ?? '',
    changeSummary: row.change_summary ?? '',
    status: row.status as QmDocumentStatus,
    approvedAt: row.approved_at,
    approvedBy: row.approved_by,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapVersionRowsToList(
  rows: QmDocumentVersionLiveRow[],
): ServiceResult<QmDocumentVersion[]> {
  if (rows.length === 0) {
    return { ok: true, data: [] };
  }

  const schemaMissing = new Set<string>();
  for (const row of rows) {
    if (row.document_id === undefined) schemaMissing.add('document_id');
    if (row.version_number === undefined) schemaMissing.add('version_number');
    if (row.status === undefined) schemaMissing.add('status');
  }
  if (schemaMissing.size > 0) {
    const fields = [...schemaMissing].sort().join(', ');
    return {
      ok: false,
      error: `Live-QM-Dokumentversionen: Supabase-Schema unvollständig (${fields} fehlen). Migration 0015 prüfen.`,
    };
  }

  const data = rows.filter((row) => row.version_number?.trim()).map(mapVersionRow);

  return { ok: true, data };
}
