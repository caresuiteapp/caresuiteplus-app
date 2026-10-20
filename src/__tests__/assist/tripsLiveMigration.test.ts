import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('trips live migration 0021', () => {
  it('Migration fügt Live-Felder mit IF NOT EXISTS hinzu', () => {
    const sql = readSrc('supabase/migrations/0021_trips_live_list_fields.sql');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS employee_name');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS vehicle_label');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS purpose');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS started_at');
    expect(sql).not.toMatch(/^\s*DROP\b/im);
    expect(sql).not.toMatch(/^\s*TRUNCATE\b/im);
  });

  it('tripListMapper exportiert TRIP_LIVE_SELECT_COLUMNS', () => {
    const source = readSrc('src/lib/assist/tripListMapper.ts');
    expect(source).toContain('TRIP_LIVE_SELECT_COLUMNS');
    expect(source).toContain('employee_name, vehicle_label, purpose, started_at');
  });
});
