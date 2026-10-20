import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  mapReadConfirmationRow,
  mapReadConfirmationRowsToList,
  READ_CONFIRMATION_LIVE_SELECT_COLUMNS,
  type QmReadConfirmationLiveRow,
} from '@/lib/qm/qmReadConfirmationMapper';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

const sampleRow: QmReadConfirmationLiveRow = {
  id: 'rc-1',
  tenant_id: 'tenant-1',
  document_id: 'doc-1',
  document_version_id: 'ver-1',
  user_id: 'user-1',
  user_display_name: 'Maria Pflege',
  confirmed_at: '2026-03-01T10:00:00.000Z',
  created_at: '2026-03-01T10:00:00.000Z',
  updated_at: '2026-03-01T10:00:00.000Z',
};

describe('QM read confirmations live mapper (Sprint 44)', () => {
  it('mapReadConfirmationRow mappt Supabase-Zeile auf QmReadConfirmation', () => {
    const confirmation = mapReadConfirmationRow(sampleRow);
    expect(confirmation.id).toBe('rc-1');
    expect(confirmation.documentId).toBe('doc-1');
    expect(confirmation.documentVersionId).toBe('ver-1');
    expect(confirmation.userDisplayName).toBe('Maria Pflege');
    expect(confirmation.confirmedAt).toBe('2026-03-01T10:00:00.000Z');
  });

  it('mapReadConfirmationRow nutzt user_id als Fallback für Anzeigename', () => {
    const confirmation = mapReadConfirmationRow({
      ...sampleRow,
      user_display_name: '  ',
    });
    expect(confirmation.userDisplayName).toBe('user-1');
  });

  it('mapReadConfirmationRowsToList liefert leere Liste bei leeren Zeilen', () => {
    const result = mapReadConfirmationRowsToList([]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual([]);
  });

  it('READ_CONFIRMATION_LIVE_SELECT_COLUMNS deckt Migration-0015-Felder ab', () => {
    expect(READ_CONFIRMATION_LIVE_SELECT_COLUMNS).toContain('document_id');
    expect(READ_CONFIRMATION_LIVE_SELECT_COLUMNS).toContain('document_version_id');
    expect(READ_CONFIRMATION_LIVE_SELECT_COLUMNS).toContain('user_id');
    expect(READ_CONFIRMATION_LIVE_SELECT_COLUMNS).toContain('user_display_name');
    expect(READ_CONFIRMATION_LIVE_SELECT_COLUMNS).toContain('confirmed_at');
  });

  it('fetchQmReadConfirmations nutzt guardServiceTenant und Live-Repo', () => {
    const source = readSrc('src/lib/qm/qmDocumentService.ts');
    expect(source).toContain('listReadConfirmationsMapped');
    expect(source).toContain('getServiceMode');
    expect(source).not.toMatch(/DEMO_TENANT_ID/);
  });

  it('qmRepository.supabase nutzt Lesebestätigungs-Mapper', () => {
    const source = readSrc('src/lib/qm/qmRepository.supabase.ts');
    expect(source).toContain('READ_CONFIRMATION_LIVE_SELECT_COLUMNS');
    expect(source).toContain('listReadConfirmationsMapped');
    expect(source).toContain('qm_read_confirmations');
  });

  it('Migration 0015 enthält qm_read_confirmations ohne DROP', () => {
    const sql = readSrc('supabase/migrations/0015_quality_management_module.sql');
    expect(sql).toContain('qm_read_confirmations');
    expect(sql).not.toMatch(/^\s*DROP\b/im);
    expect(sql).not.toMatch(/^\s*TRUNCATE\b/im);
  });
});
