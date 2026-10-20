import type { ServiceResult } from '@/types';
import type { QmDocumentStatus } from './qm.types';
import type { QmHandbookChapter } from './qm.types';

/** Spalten aus Migration 0015 — vollständiges Handbuch-Kapitel-Schema. */
export const CHAPTER_LIVE_SELECT_COLUMNS =
  'id, tenant_id, handbook_id, parent_id, sort_order, title, content, version, status, last_reviewed_at, created_at, updated_at';

export type QmChapterLiveRow = {
  id: string;
  tenant_id: string;
  handbook_id: string;
  parent_id: string | null;
  sort_order: number;
  title: string;
  content: string;
  version: string;
  status: string;
  last_reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export function mapChapterRow(row: QmChapterLiveRow): QmHandbookChapter {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    handbookId: row.handbook_id,
    parentId: row.parent_id,
    sortOrder: row.sort_order,
    title: row.title.trim(),
    content: row.content ?? '',
    version: row.version.trim(),
    status: row.status as QmDocumentStatus,
    lastReviewedAt: row.last_reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapChapterRowsToList(
  rows: QmChapterLiveRow[],
): ServiceResult<QmHandbookChapter[]> {
  if (rows.length === 0) {
    return { ok: true, data: [] };
  }

  const schemaMissing = new Set<string>();
  for (const row of rows) {
    if (row.handbook_id === undefined) schemaMissing.add('handbook_id');
    if (row.sort_order === undefined) schemaMissing.add('sort_order');
    if (row.title === undefined) schemaMissing.add('title');
    if (row.content === undefined) schemaMissing.add('content');
    if (row.version === undefined) schemaMissing.add('version');
    if (row.status === undefined) schemaMissing.add('status');
  }
  if (schemaMissing.size > 0) {
    const fields = [...schemaMissing].sort().join(', ');
    return {
      ok: false,
      error: `Live-QM-Handbuch: Supabase-Schema unvollständig (${fields} fehlen). Migration 0015 prüfen.`,
    };
  }

  const data = rows
    .filter((row) => row.title?.trim())
    .map(mapChapterRow);

  return { ok: true, data };
}

export function mapChapterRowToDetail(
  row: QmChapterLiveRow | null,
): ServiceResult<QmHandbookChapter> {
  if (!row) {
    return { ok: false, error: 'Kapitel nicht gefunden.' };
  }
  if (!row.title?.trim()) {
    return { ok: false, error: 'Live-QM-Kapitel: Titel fehlt in Supabase.' };
  }
  return { ok: true, data: mapChapterRow(row) };
}
