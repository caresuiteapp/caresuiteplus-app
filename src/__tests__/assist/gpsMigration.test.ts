import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { isGpsTrackingLiveReady } from '@/lib/assist/gpsTrackingConfig';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('GPS Migration 0034 (Sprint 79)', () => {
  it('Migration 0034 erstellt trip_gps_events additiv', () => {
    const sql = readSrc('supabase/migrations/0034_trip_gps_events_prepared.sql');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.trip_gps_events');
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
    const sqlWithoutComments = sql.replace(/--[^\n]*/g, '');
    expect(sqlWithoutComments).not.toMatch(/\bDROP TABLE\b|\bTRUNCATE\b|\bDELETE FROM\b/i);
  });

  it('apply-live-migrations listet 0034', () => {
    const script = readSrc('scripts/apply-live-migrations.mjs');
    expect(script).toContain('0034_trip_gps_events_prepared.sql');
  });

  it('isGpsTrackingLiveReady bleibt false bis Backend-Streaming', () => {
    expect(isGpsTrackingLiveReady()).toBe(false);
  });
});
