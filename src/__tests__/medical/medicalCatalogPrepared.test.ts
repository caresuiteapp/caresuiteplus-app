import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import {
  MEDICAL_CATALOG_SOURCE_REGISTRY,
  MEDICAL_LIVE_REQUIRED_MIGRATION,
  canUseMedicalCatalogInCurrentMode,
  countProtectedMedicalCatalogSources,
  getMedicalCatalogSourcesRequiringLicense,
  isMedicalCatalogLiveReady,
  isMedicalCatalogWiringPrepared,
  isMedicalFunctionBlocked,
} from '@/lib/medicalCatalog';
import {
  documentDiagnosisAsPhysicianStatement,
  documentMedicationAsMasterData,
  getMedicationDecision,
  getTherapyRecommendation,
  recordVitalSignDocumentation,
  searchIcdCodes,
} from '@/lib/medical';
import { MEDICAL_DOCUMENTATION_DISCLAIMER, MEDICAL_MDR_RISK_HINT } from '@/types/medical';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Medical Catalog Prepared (Migration 0047)', () => {
  beforeEach(() => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
  });

  it('Migration 0047 existiert', () => {
    expect(
      fs.existsSync(
        path.join(process.cwd(), 'supabase/migrations/0047_medical_catalog_prepared.sql'),
      ),
    ).toBe(true);
  });

  it('isMedicalCatalogLiveReady bleibt ehrlich false', () => {
    expect(isMedicalCatalogLiveReady()).toBe(false);
    expect(isMedicalCatalogWiringPrepared()).toBe(true);
  });

  it('Registry listet alle vorbereiteten Katalogquellen', () => {
    expect(MEDICAL_CATALOG_SOURCE_REGISTRY.length).toBe(9);
    const keys = MEDICAL_CATALOG_SOURCE_REGISTRY.map((entry) => entry.sourceKey);
    expect(keys).toContain('icd10_gm');
    expect(keys).toContain('snomed_ct');
    expect(keys).toContain('abdata');
    expect(keys).toContain('bfarm_am');
  });

  it('geschützte Quellen sind licensed_required, provider_required oder disabled', () => {
    const protectedSources = getMedicalCatalogSourcesRequiringLicense();
    expect(protectedSources.length).toBeGreaterThanOrEqual(5);
    expect(countProtectedMedicalCatalogSources()).toBeGreaterThanOrEqual(5);

    const abdata = MEDICAL_CATALOG_SOURCE_REGISTRY.find((entry) => entry.sourceKey === 'abdata');
    expect(abdata?.licenseStatus).toBe('disabled');
    expect(abdata?.isSearchEnabled).toBe(false);

    const roteListe = MEDICAL_CATALOG_SOURCE_REGISTRY.find((entry) => entry.sourceKey === 'rote_liste');
    expect(roteListe?.licenseStatus).toBe('licensed_required');

    const pzn = MEDICAL_CATALOG_SOURCE_REGISTRY.find((entry) => entry.sourceKey === 'pzn_ifa');
    expect(pzn?.licenseStatus).toBe('provider_required');
  });

  it('blockierte Funktionen (Therapie, Diagnose-KI) sind gesperrt', () => {
    expect(isMedicalFunctionBlocked('therapy_recommendation')).toBe(true);
    expect(isMedicalFunctionBlocked('diagnosis_ai')).toBe(true);
    expect(isMedicalFunctionBlocked('medication_decision')).toBe(true);

    const therapy = getTherapyRecommendation();
    expect(therapy.ok).toBe(false);
    if (!therapy.ok) expect(therapy.error).toContain('Therapieempfehlung');

    const medDecision = getMedicationDecision();
    expect(medDecision.ok).toBe(false);
    if (!medDecision.ok) expect(medDecision.error).toContain('Medikationsentscheidung');
  });

  it('ICD kann als ärztliche Angabe dokumentiert werden', async () => {
    const search = await searchIcdCodes(DEMO_TENANT_ID, 'Pneumonie', 'nurse');
    expect(search.ok).toBe(true);
    if (!search.ok) return;
    expect(search.data.results.length).toBeGreaterThan(0);
    expect(search.data.isDemoCatalog).toBe(true);

    const icd = search.data.results[0];
    const doc = await documentDiagnosisAsPhysicianStatement(
      DEMO_TENANT_ID,
      {
        clientId: 'client-001',
        icdCode: icd.code,
        icdTitle: icd.title,
        physicianStatementText: 'Vom Hausarzt mitgeteilte Diagnose.',
        disclaimerAcknowledged: true,
      },
      'nurse',
    );
    expect(doc.ok).toBe(true);
    if (doc.ok) {
      expect(doc.data.isPhysicianStatement).toBe(true);
      expect(doc.data.icdCode).toBe(icd.code);
    }
  });

  it('Dokumentation ohne Disclaimer-Bestätigung wird abgelehnt', async () => {
    const doc = await documentDiagnosisAsPhysicianStatement(
      DEMO_TENANT_ID,
      {
        clientId: 'client-001',
        icdCode: 'J18.9',
        icdTitle: 'Pneumonie',
        physicianStatementText: 'Test',
        disclaimerAcknowledged: false,
      },
      'nurse',
    );
    expect(doc.ok).toBe(false);
    if (!doc.ok) expect(doc.error).toContain(MEDICAL_DOCUMENTATION_DISCLAIMER);
  });

  it('Medikationshinweis ist nur informativ', async () => {
    const result = await documentMedicationAsMasterData(
      DEMO_TENANT_ID,
      { clientId: 'client-001', documentedName: 'Metformin 500mg' },
      'nurse',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.hint.kind).toBe('informative');
      expect(result.data.hint.noMedicalDecision).toBe(true);
      expect(result.data.hint.message).toContain('keine Medikationsentscheidung');
      expect(result.data.sourceAttribution).toBe('master_data');
    }
  });

  it('Vitalzeichen-Dokumentation ohne Risikobewertung', async () => {
    const result = await recordVitalSignDocumentation(
      DEMO_TENANT_ID,
      { clientId: 'client-001', signType: 'pulse', valueText: '72', unit: 'bpm' },
      'nurse',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.documentationHint).toContain('keine automatische Risikobewertung');
      expect(result.data.documentationHint).toContain(MEDICAL_DOCUMENTATION_DISCLAIMER);
    }
  });

  it('MDR-Hinweis ist in UI-Komponenten sichtbar', () => {
    const disclaimer = readSrc('src/components/medical/MedicalDocumentationDisclaimer.tsx');
    expect(disclaimer).toContain('MEDICAL_DOCUMENTATION_DISCLAIMER');
    expect(disclaimer).toContain('MEDICAL_MDR_RISK_HINT');

    const hub = readSrc('src/screens/medical/MedicalCatalogHubScreen.tsx');
    expect(hub).toContain('MedicalDocumentationDisclaimer');

    const icd = readSrc('src/screens/medical/IcdDocumentationScreen.tsx');
    expect(icd).toContain('MedicalDocumentationDisclaimer');
    expect(icd).toContain('ärztliche Angabe');
  });

  it('Produktivmodus nutzt keine unlizenzierten Demo-Kataloge', () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');

    expect(canUseMedicalCatalogInCurrentMode('icd10_gm')).toBe(false);
    expect(canUseMedicalCatalogInCurrentMode('abdata')).toBe(false);
    expect(canUseMedicalCatalogInCurrentMode('snomed_ct')).toBe(false);

    vi.unstubAllEnvs();
  });

  it('Mandantenisolation — falscher Tenant wird blockiert', () => {
    const block = guardServiceTenant('wrong-tenant-id');
    expect(block).not.toBeNull();
    expect(block?.ok).toBe(false);
  });

  it('medicalLiveRepository referenziert Migration 0047', () => {
    const repo = readSrc('src/lib/medicalCatalog/medicalLiveRepository.ts');
    expect(repo).toContain(MEDICAL_LIVE_REQUIRED_MIGRATION);
    expect(repo).toContain('medical_catalog_sources');
    expect(repo).toContain('medical_audit_events');
  });

  it('Connect-Katalog medical_data enthält Lizenz-Hinweise', () => {
    const catalog = readSrc('src/lib/connect/connectCatalog.ts');
    expect(catalog).toContain('rote_liste');
    expect(catalog).toContain('abdata');
    expect(catalog).toContain('Lizenz erforderlich');
    expect(catalog).toContain('deaktiviert');
  });
});

describe('Medical MDR Protection Texts', () => {
  it('Pflicht-Disclaimer und MDR-Risiko sind definiert', () => {
    expect(MEDICAL_DOCUMENTATION_DISCLAIMER).toContain('Dokumentation');
    expect(MEDICAL_DOCUMENTATION_DISCLAIMER).toContain('keine medizinische Entscheidung');
    expect(MEDICAL_MDR_RISK_HINT).toContain('MDR');
    expect(MEDICAL_MDR_RISK_HINT).toContain('kein Medizinprodukt');
  });
});
