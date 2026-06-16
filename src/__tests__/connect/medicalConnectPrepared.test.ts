import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getConnectCategory, getConnectIntegration } from '@/lib/connect/connectCatalog';
import { MEDICAL_DOCUMENTATION_DISCLAIMER } from '@/types/medical';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Connect Medical Data Category', () => {
  it('medical_data Kategorie ist prepared', () => {
    const category = getConnectCategory('medical_data');
    expect(category?.readiness).toBe('prepared');
    expect(category?.integrations.length).toBeGreaterThanOrEqual(8);
  });

  it('ICD-10-GM ist prepared, ABDATA und Rote Liste disabled', () => {
    const icd = getConnectIntegration('medical_data', 'icd10_gm');
    expect(icd?.readiness).toBe('prepared');

    const abdata = getConnectIntegration('medical_data', 'abdata');
    expect(abdata?.readiness).toBe('disabled');

    const roteListe = getConnectIntegration('medical_data', 'rote_liste');
    expect(roteListe?.readiness).toBe('disabled');
  });

  it('Connect-UI zeigt keine Therapie- oder Diagnose-KI-Ansprüche', () => {
    const catalog = readSrc('src/lib/connect/connectCatalog.ts');
    expect(catalog).not.toMatch(/Diagnose-KI/i);
    expect(catalog).not.toMatch(/Therapieempfehlung/i);
    expect(catalog).not.toMatch(/MDR-konform/i);
    expect(catalog).toContain('Dokumentationshilfe');
  });

  it('medical_data Connect-Kategorie verweist auf Dokumentationshilfe', () => {
    const medikationsdb = getConnectIntegration('medical_data', 'medikationsdb');
    expect(medikationsdb?.description).toContain('keine Medikationsentscheidung');
  });

  it('Medical Hub Route ist registriert', () => {
    const routes = readSrc('src/lib/navigation/routes.ts');
    expect(routes).toContain("path: '/medical'");
    expect(routes).toContain("path: '/medical/icd'");
  });

  it('MedicalDocumentationDisclaimer enthält Pflichttext', () => {
    const component = readSrc('src/components/medical/MedicalDocumentationDisclaimer.tsx');
    expect(component).toContain('MEDICAL_DOCUMENTATION_DISCLAIMER');
  });
});
