import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  mapChapterRow,
  mapChapterRowsToList,
  mapChapterRowToDetail,
  CHAPTER_LIVE_SELECT_COLUMNS,
  type QmChapterLiveRow,
} from '@/lib/qm/qmChapterMapper';
import {
  mapHandbookRow,
  mapHandbookRowToDetail,
  HANDBOOK_LIVE_SELECT_COLUMNS,
  type QmHandbookLiveRow,
} from '@/lib/qm/qmHandbookMapper';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

const sampleChapterRow: QmChapterLiveRow = {
  id: 'ch-1',
  tenant_id: 'tenant-1',
  handbook_id: 'hb-1',
  parent_id: null,
  sort_order: 1,
  title: 'Qualitätsmanagement',
  content: 'Inhalt',
  version: '1.0',
  status: 'published',
  last_reviewed_at: '2026-01-01T00:00:00.000Z',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-02T00:00:00.000Z',
};

const sampleHandbookRow: QmHandbookLiveRow = {
  id: 'hb-1',
  tenant_id: 'tenant-1',
  title: 'QM-Handbuch',
  version: '2.0',
  status: 'active',
  approved_at: '2026-01-01T00:00:00.000Z',
  approved_by: 'QMB',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-02T00:00:00.000Z',
};

describe('QM handbook live mapper (Sprint 39)', () => {
  it('mapChapterRow mappt Supabase-Zeile auf QmHandbookChapter', () => {
    const chapter = mapChapterRow(sampleChapterRow);
    expect(chapter.id).toBe('ch-1');
    expect(chapter.handbookId).toBe('hb-1');
    expect(chapter.title).toBe('Qualitätsmanagement');
    expect(chapter.status).toBe('published');
  });

  it('mapChapterRowsToList liefert leere Liste bei leeren Zeilen', () => {
    const result = mapChapterRowsToList([]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual([]);
  });

  it('mapChapterRowsToList filtert Zeilen ohne Titel', () => {
    const result = mapChapterRowsToList([
      sampleChapterRow,
      { ...sampleChapterRow, id: 'ch-2', title: '  ' },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toHaveLength(1);
  });

  it('mapChapterRowToDetail meldet fehlendes Kapitel', () => {
    const result = mapChapterRowToDetail(null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('nicht gefunden');
  });

  it('mapHandbookRow mappt Supabase-Zeile auf QmHandbook', () => {
    const handbook = mapHandbookRow(sampleHandbookRow);
    expect(handbook.title).toBe('QM-Handbuch');
    expect(handbook.version).toBe('2.0');
    expect(handbook.status).toBe('active');
  });

  it('mapHandbookRowToDetail meldet fehlendes Handbuch', () => {
    const result = mapHandbookRowToDetail(null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('nicht gefunden');
  });

  it('CHAPTER_LIVE_SELECT_COLUMNS deckt Migration-0015-Felder ab', () => {
    expect(CHAPTER_LIVE_SELECT_COLUMNS).toContain('handbook_id');
    expect(CHAPTER_LIVE_SELECT_COLUMNS).toContain('parent_id');
    expect(CHAPTER_LIVE_SELECT_COLUMNS).toContain('sort_order');
    expect(CHAPTER_LIVE_SELECT_COLUMNS).toContain('last_reviewed_at');
  });

  it('HANDBOOK_LIVE_SELECT_COLUMNS deckt Migration-0015-Felder ab', () => {
    expect(HANDBOOK_LIVE_SELECT_COLUMNS).toContain('approved_at');
    expect(HANDBOOK_LIVE_SELECT_COLUMNS).toContain('approved_by');
  });

  it('qmHandbookService nutzt guardServiceTenant und Live-Repo', () => {
    const source = readSrc('src/lib/qm/qmHandbookService.ts');
    expect(source).toContain('guardServiceTenant');
    expect(source).toContain('getServiceMode');
    expect(source).toContain('qmSupabaseRepository');
    expect(source).toContain('listChaptersMapped');
    expect(source).toContain('getChapterMapped');
    expect(source).toContain('getHandbookMapped');
    expect(source).not.toContain('Live-Anbindung vorbereitet');
    expect(source).not.toMatch(/DEMO_TENANT_ID/);
  });

  it('qmRepository.supabase nutzt toGermanSupabaseError und Mapper', () => {
    const source = readSrc('src/lib/qm/qmRepository.supabase.ts');
    expect(source).toContain('toGermanSupabaseError');
    expect(source).toContain('CHAPTER_LIVE_SELECT_COLUMNS');
    expect(source).toContain('HANDBOOK_LIVE_SELECT_COLUMNS');
    expect(source).not.toContain('Migration 0014');
  });

  it('Migration 0015 enthält qm_handbook_chapters ohne DROP', () => {
    const sql = readSrc('supabase/migrations/0015_quality_management_module.sql');
    expect(sql).toContain('qm_handbook_chapters');
    expect(sql).toContain('qm_handbooks');
    expect(sql).not.toMatch(/^\s*DROP\b/im);
    expect(sql).not.toMatch(/^\s*TRUNCATE\b/im);
  });
});
