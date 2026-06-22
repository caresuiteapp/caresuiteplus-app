import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import {
  DEFAULT_ENTLASTUNGSBETRAG_MONTHLY_CENTS,
} from '@/types/careBilling';
import {
  assertNoDemoFallbackInProduction,
  createBillableItemFromServiceProof,
  createDefaultBudgetConfig,
  finalizeBillingRunInvoices,
  generateInvoiceDraftsFromRun,
  getBillableItem,
  getReceivable,
  isBillableItemAlreadyInRun,
  listBillingAuditEvents,
  listBillingRuns,
  listOpenDueReceivables,
  listReceivables,
  prepareBillingRun,
  prepareDunningRun,
  resetBillingCycleStore,
  resetCareBillingStore,
  saveBillingRecipientProfile,
  saveBudgetPeriod,
  saveCostCarrierProfile,
  saveServiceRate,
  writeBudgetConfig,
} from '@/lib/careBilling';
import type { ClientBudgetPeriod, TenantServiceRate } from '@/types/careBilling';
import { saveReceivable } from '@/lib/careBilling/billingCycleStore';

const TENANT_A = DEMO_TENANT_ID;
const TENANT_B = 'tenant-billing-cycle-isolation';
const CLIENT = 'client-001';
const BILLING_MONTH = '2026-06';
const NOW = '2026-06-01T10:00:00.000Z';

function makeBudgetPeriod(
  overrides: Partial<ClientBudgetPeriod> & Pick<ClientBudgetPeriod, 'id' | 'budgetType'>,
): ClientBudgetPeriod {
  return {
    tenantId: TENANT_A,
    clientId: CLIENT,
    year: 2026,
    month: 6,
    totalAmountCents: DEFAULT_ENTLASTUNGSBETRAG_MONTHLY_CENTS,
    usedAmountCents: 0,
    reservedAmountCents: 0,
    status: 'aktiv',
    validFrom: '2026-06-01',
    validUntil: '2026-06-30',
    umwandlungMaxPercent: 40,
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeServiceRate(overrides: Partial<TenantServiceRate> = {}): TenantServiceRate {
  return {
    id: 'rate-betreuung',
    tenantId: TENANT_A,
    serviceAreaKey: 'betreuung',
    hourlyRateNetCents: 3800,
    hourlyRateGrossCents: 3800,
    taxRatePercent: 0,
    taxMode: 'ustg_4_16_exempt',
    validFrom: '2026-01-01',
    validTo: null,
    billingUnit: 'hour',
    roundingRule: 'up_to_quarter_hour',
    minimumDurationMinutes: 30,
    travelCostRule: 'none',
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function seedTenantFixtures(tenantId: string = TENANT_A) {
  writeBudgetConfig(tenantId, createDefaultBudgetConfig(tenantId));
  saveBudgetPeriod(
    tenantId,
    makeBudgetPeriod({ id: 'bud-45b', budgetType: 'paragraph_45b', tenantId, clientId: CLIENT }),
  );
  saveServiceRate(tenantId, makeServiceRate({ tenantId }));
  saveCostCarrierProfile(tenantId, {
    id: 'cc-1',
    tenantId,
    clientId: CLIENT,
    name: 'AOK Nordost',
    ikNumber: '109519005',
    type: 'pflegekasse',
    isPrimary: true,
    validFrom: '2026-01-01',
    validTo: null,
    createdAt: NOW,
    updatedAt: NOW,
  });
  saveBillingRecipientProfile(tenantId, {
    id: 'rec-pk',
    tenantId,
    clientId: CLIENT,
    recipientType: 'pflegekasse',
    fullName: 'AOK Nordost',
    street: 'Berlin',
    zip: '10115',
    city: 'Berlin',
    email: null,
    phone: null,
    isPrimary: true,
    costCarrierProfileId: 'cc-1',
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
  });
}

function validProofInput(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: TENANT_A,
    clientId: CLIENT,
    serviceProofId: `proof-${Math.random().toString(36).slice(2, 7)}`,
    serviceAreaKey: 'betreuung' as const,
    servicePeriodFrom: '2026-06-01',
    servicePeriodTo: '2026-06-15',
    durationMinutes: 90,
    proofStatus: 'finalized' as const,
    careGrade: 'pg2',
    costCarrierProfileId: 'cc-1',
    billingRecipientProfileId: 'rec-pk',
    ...overrides,
  };
}

function seedReadyBillableItem() {
  const result = createBillableItemFromServiceProof(validProofInput());
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('Fixture fehlgeschlagen');
  return result.item;
}

function runFullCycle(previewConfirmed = true) {
  seedReadyBillableItem();
  const prep = prepareBillingRun({ tenantId: TENANT_A, billingMonth: BILLING_MONTH });
  expect(prep.ok).toBe(true);
  if (!prep.ok || !prep.billingRunId) throw new Error('prepare failed');

  const drafts = generateInvoiceDraftsFromRun(TENANT_A, prep.billingRunId);
  expect(drafts.ok).toBe(true);

  const finalize = finalizeBillingRunInvoices({
    tenantId: TENANT_A,
    billingRunId: prep.billingRunId,
    previewConfirmed,
  });
  return { prep, drafts, finalize, billingRunId: prep.billingRunId };
}

describe('CareSuite+ Monatsabschluss / Rechnungslauf / Mahnwesen', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    resetCareBillingStore();
    resetBillingCycleStore();
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    seedTenantFixtures();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetCareBillingStore();
    resetBillingCycleStore();
  });

  it('1. Monatsabschluss-Rechnungslauf aus abrechnungsbereiten Positionen', () => {
    const item = seedReadyBillableItem();
    expect(item.status).toBe('ready');

    const prep = prepareBillingRun({ tenantId: TENANT_A, billingMonth: BILLING_MONTH });
    expect(prep.ok).toBe(true);
    expect(prep.itemCount).toBe(1);

    const drafts = generateInvoiceDraftsFromRun(TENANT_A, prep.billingRunId!);
    expect(drafts.ok).toBe(true);
    expect(drafts.draftsCreated).toBe(1);

    const finalize = finalizeBillingRunInvoices({
      tenantId: TENANT_A,
      billingRunId: prep.billingRunId!,
      previewConfirmed: true,
    });
    expect(finalize.ok).toBe(true);
    expect(finalize.invoicesFinalized).toBe(1);
    expect(finalize.receivablesCreated).toBe(1);

    const audit = listBillingAuditEvents(TENANT_A);
    expect(audit.some((e) => e.action === 'billing_cycle.run_completed')).toBe(true);
  });

  it('2. Keine Doppelabrechnung — bereits verarbeitete Position blockiert', () => {
    const item = seedReadyBillableItem();
    const prep = prepareBillingRun({ tenantId: TENANT_A, billingMonth: BILLING_MONTH });
    expect(prep.ok).toBe(true);

    generateInvoiceDraftsFromRun(TENANT_A, prep.billingRunId!);

    const itemAfterDraft = getBillableItem(TENANT_A, item.id);
    expect(itemAfterDraft?.status).toBe('included_in_invoice_draft');
    expect(isBillableItemAlreadyInRun(TENANT_A, item.id)).toBe(true);

    const secondDraft = generateInvoiceDraftsFromRun(TENANT_A, prep.billingRunId!);
    expect(secondDraft.draftsCreated).toBe(0);
    expect(secondDraft.blockedCount).toBe(0);
  });

  it('3. Keine Rechnungsfinalisierung ohne Pflichtvalidierung (Vorschau)', () => {
    seedReadyBillableItem();
    const prep = prepareBillingRun({ tenantId: TENANT_A, billingMonth: BILLING_MONTH });
    generateInvoiceDraftsFromRun(TENANT_A, prep.billingRunId!);

    const finalize = finalizeBillingRunInvoices({
      tenantId: TENANT_A,
      billingRunId: prep.billingRunId!,
      previewConfirmed: false,
    });
    expect(finalize.ok).toBe(false);
    expect(finalize.blockedReason).toMatch(/Vorschau/);
  });

  it('4. Gesetzliche Kassenabrechnung nur vorbereitet, nicht produktiv', () => {
    const { finalize } = runFullCycle();
    expect(finalize.invoicesFinalized).toBe(1);

    const runs = listBillingRuns(TENANT_A);
    const run = runs[0];
    const items = finalize.invoicesFinalized;
    expect(items).toBeGreaterThan(0);

    const invoices = listReceivables(TENANT_A);
    expect(invoices.length).toBe(1);

    const audit = listBillingAuditEvents(TENANT_A);
    expect(
      audit.some((e) => e.action === 'billing_cycle.invoice_sent_prepared' && e.summary.includes('vorbereitet')),
    ).toBe(true);
  });

  it('5. Forderung aus finalisierter Rechnung mit offenem Betrag', () => {
    runFullCycle();
    const receivables = listReceivables(TENANT_A);
    expect(receivables).toHaveLength(1);
    expect(receivables[0].openAmountCents).toBeGreaterThan(0);
    expect(receivables[0].invoiceNumber).toBeTruthy();
  });

  it('6. Kein Mahnlauf ohne offene fällige Forderung', () => {
    runFullCycle();
    const blocked = prepareDunningRun({ tenantId: TENANT_A });
    expect(blocked.ok).toBe(false);
    expect(blocked.blockedReason).toMatch(/Kein Mahnlauf/);

    const receivable = listReceivables(TENANT_A)[0];
    saveReceivable(TENANT_A, { ...receivable, dueDate: '2020-01-01', dunningStatus: 'overdue' });

    const dunning = prepareDunningRun({ tenantId: TENANT_A });
    expect(dunning.ok).toBe(true);
    expect(dunning.receivableCount).toBe(1);
  });

  it('7. Mandantenisolation — Tenant B sieht keine Läufe von Tenant A', () => {
    runFullCycle();
    seedTenantFixtures(TENANT_B);

    expect(listBillingRuns(TENANT_A).length).toBe(1);
    expect(listBillingRuns(TENANT_B).length).toBe(0);
    expect(listReceivables(TENANT_A).length).toBe(1);
    expect(listReceivables(TENANT_B).length).toBe(0);
  });

  it('8. Kein Demo-Fallback im Production Mode', () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');

    const demoFallback = assertNoDemoFallbackInProduction(true);
    expect(demoFallback.allowed).toBe(false);
    if (!demoFallback.allowed) {
      expect(demoFallback.reason).toMatch(/Demo-Fallback/);
    }

    seedReadyBillableItem();
    const prep = prepareBillingRun({ tenantId: TENANT_A, billingMonth: BILLING_MONTH });
    expect(prep.ok).toBe(false);
    expect(prep.blockedReason).toMatch(/Live-Modus/);
  });
});
