import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('care_records live migration 0023', () => {
  it('Migration fügt Live-Felder mit IF NOT EXISTS hinzu', () => {
    const sql = readSrc('supabase/migrations/0023_care_records_live_list_fields.sql');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS record_type');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS first_name');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS last_name');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS wing');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS admission_date');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS care_level');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS room_name');
    expect(sql).not.toMatch(/^\s*DROP\b/im);
    expect(sql).not.toMatch(/^\s*TRUNCATE\b/im);
  });

  it('residentListMapper exportiert RESIDENT_LIVE_SELECT_COLUMNS', () => {
    const source = readSrc('src/lib/stationaer/residentListMapper.ts');
    expect(source).toContain('RESIDENT_LIVE_SELECT_COLUMNS');
    expect(source).toContain('first_name, last_name, wing, admission_date, care_level, room_name');
  });
});
