import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  handleMissingTableQuery,
  isMissingTableError,
  resolveMissingTableList,
} from '@/lib/supabase/missingtablefallback';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('missingTableFallback', () => {
  it('isMissingTableError erkennt PGRST205 und schema cache', () => {
    expect(
      isMissingTableError({
        code: 'PGRST205',
        message: "Could not find the table 'public.catalogs' in the schema cache",
        details: null,
        hint: null,
      }),
    ).toBe(true);
    expect(
      isMissingTableError(
        "Tabelle nicht verfügbar (Could not find the table 'public.catalogs' in the schema cache)",
      ),
    ).toBe(true);
  });

  it('handleMissingTableQuery liefert Demo-Daten statt Fehler', () => {
    const result = handleMissingTableQuery(
      {
        ok: false,
        error:
          "Tabelle nicht verfügbar (Could not find the table 'public.catalogs' in the schema cache)",
      },
      [{ id: 'demo-1' }],
      'demo-tenant',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual([{ id: 'demo-1' }]);
      expect(result.previewData).toBe(true);
    }
  });

  it('resolveMissingTableList respektiert tableMissing-Flag', () => {
    const result = resolveMissingTableList(
      { ok: true, data: [], tableMissing: true },
      'demo-tenant',
      () => [{ id: 'plan-1' }],
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual([{ id: 'plan-1' }]);
      expect(result.usedDemoFallback).toBe(true);
    }
  });

  it('resolveMissingTableList blockiert Demo-Fallback im Supabase-Modus', () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');

    const result = resolveMissingTableList(
      { ok: false, error: 'PGRST205 Could not find the table' },
      '56180c22-b894-4fab-b55e-a563c94dd6e7',
      () => [{ id: 'demo' }],
    );

    expect(result.ok).toBe(false);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('Akademie courseListService nutzt resolveMissingTableList', () => {
    const source = readSrc('src/lib/akademie/courseListService.ts');
    expect(source).toContain('resolveMissingTableList');
    expect(source).toContain('getDemoCourseListItems');
    expect(source).toContain('tableMissing');
  });

  it('Stationaer residentListService nutzt resolveMissingTableList', () => {
    const source = readSrc('src/lib/stationaer/residentListService.ts');
    expect(source).toContain('resolveMissingTableList');
    expect(source).toContain('previewData');
  });
});
