import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('catalogs live migration 0025', () => {
  it('Migration fügt Live-Felder mit IF NOT EXISTS hinzu', () => {
    const sql = readSrc('supabase/migrations/0025_catalogs_live_list_fields.sql');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS category');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS duration_minutes');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS is_mandatory');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS starts_at');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS enrollment_count');
    expect(sql).not.toMatch(/^\s*DROP\b/im);
    expect(sql).not.toMatch(/^\s*TRUNCATE\b/im);
  });

  it('courseListMapper exportiert COURSE_LIVE_SELECT_COLUMNS', () => {
    const source = readSrc('src/lib/akademie/courseListMapper.ts');
    expect(source).toContain('COURSE_LIVE_SELECT_COLUMNS');
    expect(source).toContain('category, duration_minutes, is_mandatory, starts_at, enrollment_count');
  });
});
