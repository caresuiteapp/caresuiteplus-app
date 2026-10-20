import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { VITAL_SIGN_CATALOG } from '@/lib/pflege/vitalCatalog';

const root = path.join(__dirname, '..', '..', '..');
const readSrc = (relativePath: string) => readFileSync(path.join(root, relativePath), 'utf8');

describe('Pflege Vitalwerte · Live Final', () => {
  it('enthält Pflege- und Intensivpflege-Kategorien', () => {
    expect(VITAL_SIGN_CATALOG.length).toBeGreaterThanOrEqual(39);
    expect(new Set(VITAL_SIGN_CATALOG.map((item) => item.category))).toEqual(
      new Set(['basis','koerper','pflege','haemodynamik','beatmung','blutgas']),
    );
  });
  it('jede Messart ist klientenbezogen schaltbar', () => {
    const source = readSrc('src/screens/pflege/VitalReadingCreateScreen.tsx');
    expect(source).toContain('setClientVitalConfiguration');
    expect(source).toContain('<Switch');
  });
  it('verwendet nur das Live-Repository', () => {
    const source = readSrc('src/lib/pflege/vitalService.ts');
    expect(source).toContain('vitalSignSupabaseRepository');
    expect(source).not.toContain('createDemoVitalReading');
    expect(source).not.toContain('getDemoVitalReadings');
  });
  it('Zeitstempel und Mitarbeiter werden serverseitig gesetzt', () => {
    const sql = readSrc('supabase/migrations/20260812100000_vital_signs_live_final.sql');
    expect(sql).toContain('measured_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()');
    expect(sql).toContain('recorded_by UUID NOT NULL');
    expect(sql).toContain('auth.uid()');
  });
  it('Messungen sind append-only für authentifizierte Clients', () => {
    const sql = readSrc('supabase/migrations/20260812100000_vital_signs_live_final.sql');
    expect(sql).toContain('REVOKE INSERT,UPDATE,DELETE ON public.vital_sign_measurements FROM authenticated');
  });
  it('Demo-Vitalwerte sind deaktiviert', () => {
    expect(readSrc('src/data/demo/vitalReadings.ts')).toContain('demoVitalReadings: VitalReading[] = []');
  });
});
