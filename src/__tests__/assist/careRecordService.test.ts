import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Assist Leistungsnachweise (careRecordService)', () => {
  it('nutzt guardServiceTenant statt hartem DEMO_TENANT_ID-Check', () => {
    const source = readSrc('src/lib/assist/careRecordService.ts');
    expect(source).toContain('guardServiceTenant');
    expect(source).toContain('careRecordSupabaseRepository');
    expect(source).not.toContain("error: 'Kein Zugriff auf diesen Mandanten.'");
    expect(source).not.toContain('tenantId !== DEMO_TENANT_ID');
  });

  it('LeistungsnachweiseListScreen lädt über useCareRecordList', () => {
    const source = readSrc('src/screens/assist/LeistungsnachweiseListScreen.tsx');
    expect(source).toContain('useCareRecordList');
    expect(source).toContain('assist.records.view');
  });
});
