import { beforeEach, describe, expect, it } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import {
  createBillingValidationReport,
  createExportPackage,
  createRejectionCase,
  markExportAsSubmitted,
  prepareBilling,
  resetConnectBillingStore,
  saveCostCarrier,
  upsertTenantIkProfile,
  VALIDATION_MESSAGES,
  getConnectBillingStoreSnapshot,
} from '@/lib/billing/connect';

const TENANT_A = DEMO_TENANT_ID;
const TENANT_B = 'tenant-billing-isolation-test';

function validBillingCase(overrides: Record<string, unknown> = {}) {
  return {
    pflegegrad: 3,
    hasAbtretungEinwilligung: true,
    hasLeistungsnachweis: true,
    hasUnterschrift: true,
    costCarrierId: 'KT-TEST-001',
    tenantIkNumber: 'TEST-IK-MANDANT',
    leistungszeitraumFrom: '2026-05-01',
    leistungszeitraumTo: '2026-05-31',
    budgetAvailableCents: 80000,
    amountCents: 15000,
    stundensatzCents: 4200,
    rechnungsnummer: 'RE-TEST-001',
    leistungsart: 'SGB XI §36',
    ...overrides,
  };
}

describe('Connect Abrechnung (vorbereitet)', () => {
  beforeEach(() => {
    resetConnectBillingStore();
    upsertTenantIkProfile(TENANT_A, { ikNumber: 'TEST-IK-MANDANT' });
    saveCostCarrier(TENANT_A, {
      costCarrierId: 'KT-TEST-001',
      name: 'Test Pflegekasse',
      type: 'pflegekasse',
      ikNumber: null,
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

  it('blockiert Abrechnung ohne IK', () => {
    upsertTenantIkProfile(TENANT_A, { ikNumber: null });
    const report = createBillingValidationReport(TENANT_A, validBillingCase({ tenantIkNumber: null }));
    expect(report.passed).toBe(false);
    expect(report.checks.find((c) => c.checkKey === 'ik')?.message).toBe(
      VALIDATION_MESSAGES.ikMissing,
    );
  });

  it('blockiert Abrechnung ohne Leistungsnachweis', () => {
    const report = createBillingValidationReport(
      TENANT_A,
      validBillingCase({ hasLeistungsnachweis: false }),
    );
    expect(report.passed).toBe(false);
    expect(report.checks.find((c) => c.checkKey === 'leistungsnachweis')?.message).toBe(
      VALIDATION_MESSAGES.leistungsnachweisMissing,
    );
  });

  it('blockiert Abrechnung ohne Kostenträger', () => {
    const report = createBillingValidationReport(
      TENANT_A,
      validBillingCase({ costCarrierId: null, costCarrierIk: null }),
    );
    expect(report.passed).toBe(false);
    expect(report.checks.find((c) => c.checkKey === 'kostentraeger')?.message).toBe(
      VALIDATION_MESSAGES.kostentraegerMissing,
    );
  });

  it('markiert Export nicht als eingereicht ohne Provider', () => {
    const validation = createBillingValidationReport(TENANT_A, validBillingCase());
    const created = createExportPackage({
      tenantId: TENANT_A,
      billingMode: 'leistungsnachweise_export',
      validationReport: validation,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const submit = markExportAsSubmitted(TENANT_A, created.data.batch.id);
    expect(submit.ok).toBe(false);
    if (!submit.ok) {
      expect(submit.error).toMatch(/Einreichung blockiert|nicht freigeschaltet/i);
    }
    expect(created.data.batch.submittedAt).toBeNull();
  });

  it('hält Mandantendaten isoliert', () => {
    upsertTenantIkProfile(TENANT_B, { ikNumber: 'TEST-IK-TENANT-B' });
    saveCostCarrier(TENANT_B, {
      costCarrierId: 'KT-TENANT-B',
      name: 'Tenant B Kasse',
      type: 'pflegekasse',
      ikNumber: null,
      billingAddress: null,
      electronicBillingSupported: false,
      dtaSupported: false,
      contactData: null,
      validFrom: null,
      validTo: null,
      source: 'manual',
      lastCheckedAt: null,
    });

    const snapshotA = getConnectBillingStoreSnapshot(TENANT_A);
    const snapshotB = getConnectBillingStoreSnapshot(TENANT_B);

    expect(snapshotA.costCarriers.some((c) => c.costCarrierId === 'KT-TENANT-B')).toBe(false);
    expect(snapshotB.costCarriers.some((c) => c.costCarrierId === 'KT-TEST-001')).toBe(false);
    expect(snapshotA.ikProfile?.ikNumber).toBe('TEST-IK-MANDANT');
    expect(snapshotB.ikProfile?.ikNumber).toBe('TEST-IK-TENANT-B');
  });

  it('erstellt Validierungsbericht mit allen Prüfungen', () => {
    const report = createBillingValidationReport(TENANT_A, validBillingCase());
    expect(report.checks.length).toBe(11);
    expect(report.validationRunId).toMatch(/^val-/);
    expect(report.passed).toBe(true);
  });

  it('liefert verständliche deutsche Fehlermeldungen', () => {
    const prep = prepareBilling({
      tenantId: TENANT_A,
      billingCase: validBillingCase({ tenantIkNumber: null, hasLeistungsnachweis: false }),
    });
    expect(prep.canPrepare).toBe(false);
    expect(prep.message).toMatch(/blockiert|fehlt/i);
    expect(prep.validation.blockedReason).toMatch(/IK|Leistungsnachweis/i);
  });

  it('erstellt Rückläufer-Fall auditierbar', () => {
    const validation = createBillingValidationReport(TENANT_A, validBillingCase());
    const created = createExportPackage({
      tenantId: TENANT_A,
      billingMode: 'leistungsnachweise_export',
      validationReport: validation,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const rejection = createRejectionCase({
      tenantId: TENANT_A,
      exportBatchId: created.data.batch.id,
      caseType: 'ruecklaeufer',
      reasonText: 'Test-Rückläufer vorbereitet',
    });
    expect(rejection.ok).toBe(true);
    if (!rejection.ok) return;
    expect(rejection.data.status).toBe('open');
  });
});
