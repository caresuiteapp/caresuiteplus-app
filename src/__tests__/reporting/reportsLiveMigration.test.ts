import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('reporting_reports live migration 0027', () => {
  it('Migration erstellt Tabelle mit Listen-Feldern', () => {
    const sql = readSrc('supabase/migrations/0027_reporting_reports_live_list.sql');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.reporting_reports');
    expect(sql).toContain('category');
    expect(sql).toContain('period');
    expect(sql).toContain('status');
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
    expect(sql).not.toMatch(/^\s*DROP\b/im);
    expect(sql).not.toMatch(/^\s*TRUNCATE\b/im);
  });

  it('reportListMapper exportiert REPORT_LIVE_SELECT_COLUMNS', () => {
    const source = readSrc('src/lib/reporting/reportListMapper.ts');
    expect(source).toContain('REPORT_LIVE_SELECT_COLUMNS');
    expect(source).toContain('category, period, status');
  });
});
