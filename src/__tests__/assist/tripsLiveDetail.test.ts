import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { mapTripRowToDetail } from '@/lib/assist/tripDetailMapper';
import type { TripDetailLiveRow } from '@/lib/assist/tripDetailMapper';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('trips live detail mapping', () => {
  const completeRow: TripDetailLiveRow = {
    id: 'trip-001',
    tenant_id: DEMO_TENANT_ID,
    title: 'Einsatz → Klient Müller',
    status: 'in_bearbeitung',
    employee_name: 'Anna Schmidt',
    vehicle_label: 'VW Caddy CS-01',
    purpose: 'einsatz',
    started_at: '2026-06-14T08:00:00.000Z',
    ended_at: null,
    distance_km: 12.4,
    start_address: 'Büro Mitte, Berlin',
    end_address: null,
    notes: 'Anfahrt zum Einsatz',
    created_at: '2026-06-14T08:00:00.000Z',
    updated_at: '2026-06-14T08:30:00.000Z',
  };

  it('Migration 0022 fügt Detail-Felder mit IF NOT EXISTS hinzu', () => {
    const sql = readSrc('supabase/migrations/0022_trips_live_detail_fields.sql');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS start_address');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS end_address');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS notes');
    expect(sql).not.toMatch(/^\s*DROP\b/im);
    expect(sql).not.toMatch(/^\s*TRUNCATE\b/im);
  });

  it('mapTripRowToDetail mappt vollständige Zeile', () => {
    const result = mapTripRowToDetail(completeRow);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.startAddress).toBe('Büro Mitte, Berlin');
      expect(result.data.endAddress).toBeNull();
      expect(result.data.notes).toBe('Anfahrt zum Einsatz');
      expect(result.data.routeSummary).toContain('(läuft)');
      expect(result.data.geofenceEvents).toEqual([]);
    }
  });

  it('mapTripRowToDetail meldet fehlendes Schema ehrlich', () => {
    const incomplete: TripDetailLiveRow = {
      ...completeRow,
      start_address: undefined,
    };
    const result = mapTripRowToDetail(incomplete);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Schema unvollständig');
      expect(result.error).toContain('start_address');
    }
  });

  it('mapTripRowToDetail meldet fehlende Startadresse ehrlich', () => {
    const incomplete: TripDetailLiveRow = {
      ...completeRow,
      start_address: '',
    };
    const result = mapTripRowToDetail(incomplete);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Startadresse fehlt');
    }
  });

  it('tripRepository nutzt TRIP_DETAIL_SELECT_COLUMNS und getDetailMapped', () => {
    const source = readSrc('src/lib/services/repositories/tripRepository.supabase.ts');
    expect(source).toContain('TRIP_DETAIL_SELECT_COLUMNS');
    expect(source).toContain('getDetailMapped');
    expect(source).toContain('getByIdForTripLog');
  });

  it('fetchTripDetail nutzt Supabase-Repo ohne Demo-Fallback in Live-Pfad', () => {
    const source = readSrc('src/lib/assist/tripLogService.ts');
    expect(source).toContain('getDetailMapped');
    expect(source).toMatch(
      /fetchTripDetail[\s\S]*getServiceMode\(\) === 'supabase'[\s\S]*getDetailMapped/,
    );
  });
});
