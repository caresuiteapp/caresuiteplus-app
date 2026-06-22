import { beforeEach, describe, expect, it } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import {
  assertGkvProductionNoDemoFallback,
  createGkvRejectionCase,
  createGkvValidationReport,
  getGkvBillingStoreSnapshot,
  GKV_VALIDATION_MESSAGES,
  listGkvValidationErrors,
  markGkvSubmissionAsSubmitted,
  prepareGkvBilling,
  prepareGkvExport,
  prepareGkvSubmission,
  resetGkvBillingStore,
  saveGkvCostCarrier,
  upsertGkvBillingProfile,
} from '@/lib/gkvBilling';

const TENANT_A = DEMO_TENANT_ID;
const TENANT_B = 'tenant-gkv-billing-isolation';

function validGkvBillingCase(overrides: Record<string, unknown> = {}) {
  return {
    pflegegrad: 3,
    hasAbtretungEinwilligung: true,
    hasLeistungsnachweis: true,
    hasUnterschrift: true,
    costCarrierId: 'KT-GKV-001',
    tenantIkNumber: '123456789',
    ikVerificationStatus: 'verified' as const,
    leistungszeitraumFrom: '2026-05-01',
    leistungszeitraumTo: '2026-05-31',
    budgetAvailableCents: 80000,
    amountCents: 15000,
    stundensatzCents: 4200,
    rechnungsnummer: 'RE-GKV-001',
    leistungsart: 'SGB XI §36',
    statutorySector: 'sgb_xi' as const,
    dtaValidatorConfigured: false,
    dtaValidated: false,
    ...overrides,
  };
}

describe('CareSuite+ GKV/Pflegekassenabrechnung (vorbereitet)', () => {
  beforeEach(() => {
    resetGkvBillingStore();
    upsertGkvBillingProfile(TENANT_A, {
      ikNumber: '123456789',
      statutorySector: 'sgb_xi',
      verificationStatus: 'verified',
    });
    saveGkvCostCarrier(TENANT_A, {
      costCarrierId: 'KT-GKV-001',
      name: 'Test Pflegekasse',
      type: 'pflegekasse',
      ikNumber: '987654321',
      billingAddress: null,
      electronicBillingSupported: false,
      dtaSupported: false,
      contactData: null,
      validFrom: null,
      validTo: null,
      source: 'manual',
      lastCheckedAt: null,
    });
  });

  it('1. blockiert Kassenabrechnung ohne IK', () => {
    upsertGkvBillingProfile(TENANT_A, { ikNumber: null });
    const report = createGkvValidationReport(TENANT_A, validGkvBillingCase({ tenantIkNumber: null }));
    expect(report.passed).toBe(false);
    expect(report.checks.find((c) => c.checkKey === 'ik')?.message).toBe(
      GKV_VALIDATION_MESSAGES.ikMissing,
    );
  });

  it('2. blockiert Kassenabrechnung ohne Leistungsnachweis', () => {
    const report = createGkvValidationReport(
      TENANT_A,
      validGkvBillingCase({ hasLeistungsnachweis: false }),
    );
    expect(report.passed).toBe(false);
    expect(report.checks.find((c) => c.checkKey === 'leistungsnachweis')?.message).toBe(
      GKV_VALIDATION_MESSAGES.leistungsnachweisMissing,
    );
  });

  it('3. blockiert Kassenabrechnung ohne Kostenträger', () => {
    const report = createGkvValidationReport(
      TENANT_A,
      validGkvBillingCase({ costCarrierId: null, costCarrierIk: null }),
    );
    expect(report.passed).toBe(false);
    expect(report.checks.find((c) => c.checkKey === 'kostentraeger')?.message).toBe(
      GKV_VALIDATION_MESSAGES.kostentraegerMissing,
    );
  });

  it('4. markiert DTA/Einreichung nicht als produktiv ohne Validator', () => {
    const validation = createGkvValidationReport(TENANT_A, validGkvBillingCase());
    const created = prepareGkvExport({
      tenantId: TENANT_A,
      billingMode: 'dta_vorbereitung',
      validationReport: validation,
      billableItemIds: ['bi-001'],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(created.data.batch.dtaValidated).toBe(false);
    expect(created.data.batch.notes).toMatch(/nicht validiert/i);

    const submission = prepareGkvSubmission({
      tenantId: TENANT_A,
      batchId: created.data.batch.id,
      providerKey: 'opta_data',
    });
    expect(submission.ok).toBe(true);
    if (!submission.ok) return;
    expect(submission.data.submittedAt).toBeNull();
    expect(submission.data.status).not.toBe('prepared');

    const markSubmitted = markGkvSubmissionAsSubmitted(TENANT_A, created.data.batch.id);
    expect(markSubmitted.ok).toBe(false);
    if (!markSubmitted.ok) {
      expect(markSubmitted.error).toMatch(/Validator|nicht freigeschaltet/i);
    }
  });

  it('5. hält Mandantendaten isoliert', () => {
    upsertGkvBillingProfile(TENANT_B, { ikNumber: '111222333' });
    saveGkvCostCarrier(TENANT_B, {
      costCarrierId: 'KT-TENANT-B',
      name: 'Tenant B Kasse',
      type: 'pflegekasse',
      ikNumber: '333222111',
      billingAddress: null,
      electronicBillingSupported: false,
      dtaSupported: false,
      contactData: null,
      validFrom: null,
      validTo: null,
      source: 'manual',
      lastCheckedAt: null,
    });

    const snapshotA = getGkvBillingStoreSnapshot(TENANT_A);
    const snapshotB = getGkvBillingStoreSnapshot(TENANT_B);

    expect(snapshotA.costCarriers.some((c) => c.costCarrierId === 'KT-TENANT-B')).toBe(false);
    expect(snapshotB.costCarriers.some((c) => c.costCarrierId === 'KT-GKV-001')).toBe(false);
    expect(snapshotA.billingProfile?.ikNumber).toBe('123456789');
    expect(snapshotB.billingProfile?.ikNumber).toBe('111222333');
  });

  it('6. erstellt Prüfprotokoll mit allen GKV-Prüfungen', () => {
    const report = createGkvValidationReport(TENANT_A, validGkvBillingCase());
    expect(report.checks.length).toBe(13);
    expect(report.validationRunId).toMatch(/^gkv-val-/);
    expect(report.status).toBe('validation_passed');
    expect(report.passed).toBe(true);

    const errors = listGkvValidationErrors(report);
    expect(errors.filter((e) => e.status === 'failed')).toHaveLength(0);
  });

  it('7. erstellt Rückläufer-Fall auditierbar mit deutschen Fehlermeldungen', () => {
    const prep = prepareGkvBilling({
      tenantId: TENANT_A,
      billingCase: validGkvBillingCase({ tenantIkNumber: null, hasLeistungsnachweis: false }),
    });
    expect(prep.canPrepare).toBe(false);
    expect(prep.message).toMatch(/blockiert|fehlt/i);
    expect(prep.validation.blockedReason).toMatch(/IK|Leistungsnachweis/i);

    const validation = createGkvValidationReport(TENANT_A, validGkvBillingCase());
    const created = prepareGkvExport({
      tenantId: TENANT_A,
      billingMode: 'leistungsnachweise_export',
      validationReport: validation,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const rejection = createGkvRejectionCase({
      tenantId: TENANT_A,
      exportBatchId: created.data.batch.id,
      caseType: 'ruecklaeufer',
      reasonText: 'Test-Rückläufer vorbereitet',
    });
    expect(rejection.ok).toBe(true);
    if (!rejection.ok) return;
    expect(rejection.data.status).toBe('open');

    const audit = getGkvBillingStoreSnapshot(TENANT_A).auditLog;
    expect(audit.some((e) => e.action === 'gkv.rejection_case_created')).toBe(true);
  });

  it('blockiert Demo-Fallback im Production Mode', () => {
    const decision = assertGkvProductionNoDemoFallback(true);
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.reason).toMatch(/Demo-Fallback/i);
    }
  });
});
