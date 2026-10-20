import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { mapResidentRowToDetail } from '@/lib/stationaer/residentDetailMapper';
import type { ResidentDetailLiveRow } from '@/lib/stationaer/residentDetailMapper';
import { mapResidentRowsToListItems } from '@/lib/stationaer/residentListMapper';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('care_records live detail mapping', () => {
  const completeRow: ResidentDetailLiveRow = {
    id: 'resident-001',
    tenant_id: DEMO_TENANT_ID,
    title: 'Helga Schneider',
    status: 'aktiv',
    record_type: 'resident',
    first_name: 'Helga',
    last_name: 'Schneider',
    wing: 'Sonnenschein',
    admission_date: '2026-02-14T00:00:00.000Z',
    care_level: 'Pflegegrad 3',
    room_name: '101 · Sonnenschein',
    room_id: 'room-101',
    notes: 'Mobilität eingeschränkt.',
    created_at: '2026-02-14T00:00:00.000Z',
    updated_at: '2026-06-12T00:00:00.000Z',
  };

  it('Migration 0024 fügt Detail-Felder mit IF NOT EXISTS hinzu', () => {
    const sql = readSrc('supabase/migrations/0024_care_records_live_detail_fields.sql');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS room_id');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS notes');
    expect(sql).not.toMatch(/^\s*DROP\b/im);
    expect(sql).not.toMatch(/^\s*TRUNCATE\b/im);
  });

  it('mapResidentRowsToListItems mappt vollständige Zeilen', () => {
    const result = mapResidentRowsToListItems([completeRow]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data[0]?.firstName).toBe('Helga');
      expect(result.data[0]?.roomName).toBe('101 · Sonnenschein');
    }
  });

  it('mapResidentRowToDetail mappt vollständige Zeile', () => {
    const result = mapResidentRowToDetail(completeRow);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.notes).toBe('Mobilität eingeschränkt.');
      expect(result.data.roomId).toBe('room-101');
      expect(result.data.nextActionHint).toBeTruthy();
    }
  });

  it('mapResidentRowToDetail meldet fehlendes Schema ehrlich', () => {
    const incomplete: ResidentDetailLiveRow = {
      ...completeRow,
      notes: undefined,
    };
    const result = mapResidentRowToDetail(incomplete);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Schema unvollständig');
      expect(result.error).toContain('notes');
    }
  });

  it('stationaerRepository nutzt RESIDENT_DETAIL_SELECT_COLUMNS und getDetailMapped', () => {
    const source = readSrc('src/lib/services/repositories/stationaerRepository.supabase.ts');
    expect(source).toContain('RESIDENT_DETAIL_SELECT_COLUMNS');
    expect(source).toContain('getDetailMapped');
    expect(source).toContain("eq('record_type', 'resident')");
  });

  it('fetchResidentDetail nutzt Supabase-Repo ohne Demo-Fallback in Live-Pfad', () => {
    const source = readSrc('src/lib/stationaer/residentDetailService.ts');
    expect(source).toContain('getDetailMapped');
    expect(source).toMatch(
      /fetchResidentDetail[\s\S]*getServiceMode\(\) === 'supabase'[\s\S]*getDetailMapped/,
    );
  });
});
