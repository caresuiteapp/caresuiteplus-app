import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  mapDocumentRow,
  mapDocumentRowsToList,
  mapDocumentRowToDetail,
  mapVersionRow,
  mapVersionRowsToList,
  DOCUMENT_LIVE_SELECT_COLUMNS,
  VERSION_LIVE_SELECT_COLUMNS,
  type QmDocumentLiveRow,
  type QmDocumentVersionLiveRow,
} from '@/lib/qm/qmDocumentMapper';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

const sampleDocumentRow: QmDocumentLiveRow = {
  id: 'doc-1',
  tenant_id: 'tenant-1',
  document_number: 'QM-001',
  title: 'Hygieneplan',
  document_type: 'procedure',
  status: 'published',
  current_version_id: 'ver-1',
  chapter_id: null,
  owner_role: 'QMB',
  review_due_at: '2026-12-31T00:00:00.000Z',
  tags: ['hygiene', 'pflege'],
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-02T00:00:00.000Z',
};

const sampleVersionRow: QmDocumentVersionLiveRow = {
  id: 'ver-1',
  tenant_id: 'tenant-1',
  document_id: 'doc-1',
  version_number: '1.0',
  content: 'Inhalt',
  change_summary: 'Erstversion',
  status: 'published',
  approved_at: '2026-01-01T00:00:00.000Z',
  approved_by: 'QMB',
  published_at: '2026-01-02T00:00:00.000Z',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-02T00:00:00.000Z',
};

describe('QM documents live mapper (Sprint 41)', () => {
  it('mapDocumentRow mappt Supabase-Zeile auf QmDocument', () => {
    const doc = mapDocumentRow(sampleDocumentRow);
    expect(doc.id).toBe('doc-1');
    expect(doc.documentNumber).toBe('QM-001');
    expect(doc.title).toBe('Hygieneplan');
    expect(doc.documentType).toBe('procedure');
    expect(doc.status).toBe('published');
    expect(doc.tags).toEqual(['hygiene', 'pflege']);
  });

  it('mapDocumentRowsToList liefert leere Liste bei leeren Zeilen', () => {
    const result = mapDocumentRowsToList([]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual([]);
  });

  it('mapDocumentRowsToList filtert Zeilen ohne Titel', () => {
    const result = mapDocumentRowsToList([
      sampleDocumentRow,
      { ...sampleDocumentRow, id: 'doc-2', title: '  ' },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toHaveLength(1);
  });

  it('mapDocumentRowToDetail meldet fehlendes Dokument', () => {
    const result = mapDocumentRowToDetail(null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('nicht gefunden');
  });

  it('mapVersionRow mappt Supabase-Zeile auf QmDocumentVersion', () => {
    const version = mapVersionRow(sampleVersionRow);
    expect(version.documentId).toBe('doc-1');
    expect(version.versionNumber).toBe('1.0');
    expect(version.status).toBe('published');
    expect(version.approvedBy).toBe('QMB');
  });

  it('mapVersionRowsToList liefert leere Liste bei leeren Zeilen', () => {
    const result = mapVersionRowsToList([]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual([]);
  });

  it('DOCUMENT_LIVE_SELECT_COLUMNS deckt Migration-0015-Felder ab', () => {
    expect(DOCUMENT_LIVE_SELECT_COLUMNS).toContain('document_number');
    expect(DOCUMENT_LIVE_SELECT_COLUMNS).toContain('document_type');
    expect(DOCUMENT_LIVE_SELECT_COLUMNS).toContain('current_version_id');
    expect(DOCUMENT_LIVE_SELECT_COLUMNS).toContain('review_due_at');
    expect(DOCUMENT_LIVE_SELECT_COLUMNS).toContain('tags');
  });

  it('VERSION_LIVE_SELECT_COLUMNS deckt Migration-0015-Felder ab', () => {
    expect(VERSION_LIVE_SELECT_COLUMNS).toContain('version_number');
    expect(VERSION_LIVE_SELECT_COLUMNS).toContain('change_summary');
    expect(VERSION_LIVE_SELECT_COLUMNS).toContain('approved_at');
    expect(VERSION_LIVE_SELECT_COLUMNS).toContain('published_at');
  });

  it('qmDocumentService nutzt guardServiceTenant und Live-Repo', () => {
    const source = readSrc('src/lib/qm/qmDocumentService.ts');
    expect(source).toContain('guardServiceTenant');
    expect(source).toContain('getServiceMode');
    expect(source).toContain('qmSupabaseRepository');
    expect(source).toContain('listDocumentsMapped');
    expect(source).toContain('getDocumentMapped');
    expect(source).toContain('listDocumentVersionsMapped');
    expect(source).not.toContain('Live-Anbindung vorbereitet');
    expect(source).not.toMatch(/DEMO_TENANT_ID/);
  });

  it('qmRepository.supabase nutzt Dokument-Mapper', () => {
    const source = readSrc('src/lib/qm/qmRepository.supabase.ts');
    expect(source).toContain('DOCUMENT_LIVE_SELECT_COLUMNS');
    expect(source).toContain('VERSION_LIVE_SELECT_COLUMNS');
    expect(source).toContain('listDocumentsMapped');
    expect(source).toContain('getDocumentMapped');
    expect(source).toContain('listDocumentVersionsMapped');
  });

  it('qmService Dashboard nutzt listDocumentsMapped', () => {
    const source = readSrc('src/lib/qm/qmService.ts');
    expect(source).toContain('listDocumentsMapped');
  });

  it('Migration 0015 enthält qm_documents ohne DROP', () => {
    const sql = readSrc('supabase/migrations/0015_quality_management_module.sql');
    expect(sql).toContain('qm_documents');
    expect(sql).toContain('qm_document_versions');
    expect(sql).not.toMatch(/^\s*DROP\b/im);
    expect(sql).not.toMatch(/^\s*TRUNCATE\b/im);
  });
});
