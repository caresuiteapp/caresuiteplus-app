import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import {
  DEFAULT_ENTLASTUNGSBETRAG_MONTHLY_CENTS,
} from '@/types/careBilling';
import { USTG_4_16_NOTICE } from '@/types/documents/invoice';
import { KLEINUNTERNEHMER_NOTICE } from '@/types/documents/invoice';
import {
  allocateBudgetForAmount,
  assertServiceRateAvailable,
  calculateCareBillingTax,
  createBillableItemFromServiceProof,
  createCareBillingValidationReport,
  createCareInvoiceDraft,
  createDefaultBudgetConfig,
  finalizeCareInvoiceDraft,
  getEntlastungsbetragMonthlyCents,
  isUmwandlungEnabled,
  listBillableItems,
  parseCareGrade,
  resetCareBillingStore,
  resolveBillingRecipient,
  resolveTaxModeForService,
  saveBillingRecipientProfile,
  saveBudgetPeriod,
  saveCostCarrierProfile,
  saveServiceRate,
  upsertTenantTaxConfig,
  writeBudgetConfig,
  CARE_VALIDATION_MESSAGES,
} from '@/lib/careBilling';
import type { ClientBudgetPeriod, TenantServiceRate } from '@/types/careBilling';

const TENANT_A = DEMO_TENANT_ID;
const TENANT_B = 'tenant-care-billing-isolation';
const CLIENT = 'client-001';
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

function makeServiceRate(
  overrides: Partial<TenantServiceRate> = {},
): TenantServiceRate {
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
    serviceProofId: 'proof-001',
    serviceAreaKey: 'betreuung' as const,
    servicePeriodFrom: '2026-06-01',
    servicePeriodTo: '2026-06-01',
    durationMinutes: 90,
    proofStatus: 'finalized' as const,
    careGrade: 'pg2',
    costCarrierProfileId: 'cc-1',
    billingRecipientProfileId: 'rec-pk',
    ...overrides,
  };
}

describe('CareSuite+ Pflege-Abrechnung (Prompt 64)', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    resetCareBillingStore();
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    seedTenantFixtures();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetCareBillingStore();
  });

  it('1. §45b-Budget wird zuerst zugeordnet', () => {
    saveBudgetPeriod(
      TENANT_A,
      makeBudgetPeriod({
        id: 'bud-umw',
        budgetType: 'umwandlungsanspruch',
        status: 'aktiv',
        totalAmountCents: 50000,
      }),
    );
    writeBudgetConfig(TENANT_A, {
      ...createDefaultBudgetConfig(TENANT_A),
      umwandlungEnabled: true,
    });

    const result = allocateBudgetForAmount(
      TENANT_A,
      [
        makeBudgetPeriod({ id: 'bud-45b', budgetType: 'paragraph_45b', totalAmountCents: 13100 }),
        makeBudgetPeriod({ id: 'bud-umw', budgetType: 'umwandlungsanspruch', totalAmountCents: 50000, status: 'aktiv' }),
      ],
      10000,
      'pg2',
    );

    expect(result.allocations[0].budgetType).toBe('paragraph_45b');
    expect(result.selfPayerAmountCents).toBe(0);
  });

  it('2. Umwandlungsanspruch nur bei PG2–5 und aktiv/genehmigt', () => {
    writeBudgetConfig(TENANT_A, {
      ...createDefaultBudgetConfig(TENANT_A),
      umwandlungEnabled: true,
    });

    const pg1Result = allocateBudgetForAmount(
      TENANT_A,
      [makeBudgetPeriod({ id: 'bud-umw', budgetType: 'umwandlungsanspruch', status: 'aktiv', totalAmountCents: 50000 })],
      5000,
      'pg1',
    );
    expect(pg1Result.allocations).toHaveLength(0);

    const pg2Result = allocateBudgetForAmount(
      TENANT_A,
      [makeBudgetPeriod({ id: 'bud-umw', budgetType: 'umwandlungsanspruch', status: 'aktiv', totalAmountCents: 50000 })],
      5000,
      'pg2',
    );
    expect(pg2Result.allocations[0]?.budgetType).toBe('umwandlungsanspruch');
  });

  it('3. Umwandlung nicht auto-aktiv ohne Mandantenkonfiguration', () => {
    expect(isUmwandlungEnabled(TENANT_A)).toBe(false);

    const result = allocateBudgetForAmount(
      TENANT_A,
      [makeBudgetPeriod({ id: 'bud-umw', budgetType: 'umwandlungsanspruch', status: 'aktiv', totalAmountCents: 50000 })],
      5000,
      'pg3',
    );

    expect(result.allocations).toHaveLength(0);
    expect(result.warnings.some((w) => w.includes('nicht aktiviert'))).toBe(true);
  });

  it('4. Standard-Entlastungsbetrag 131,00 EUR mandantenkonfigurierbar', () => {
    expect(getEntlastungsbetragMonthlyCents(TENANT_A)).toBe(13100);
    writeBudgetConfig(TENANT_A, {
      tenantId: TENANT_A,
      entlastungsbetragMonthlyCents: 15000,
      umwandlungEnabled: false,
      updatedAt: NOW,
    });
    expect(getEntlastungsbetragMonthlyCents(TENANT_A)).toBe(15000);
  });

  it('5. Unzureichendes Budget erzeugt Selbstzahleranteil mit Warnung', () => {
    const result = allocateBudgetForAmount(
      TENANT_A,
      [makeBudgetPeriod({ id: 'bud-45b', budgetType: 'paragraph_45b', totalAmountCents: 5000 })],
      8000,
      'pg2',
    );

    expect(result.allocations[0].amountCents).toBe(5000);
    expect(result.selfPayerAmountCents).toBe(3000);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('6. Abrechnungsposition aus freigegebenem Leistungsnachweis', () => {
    const result = createBillableItemFromServiceProof(validProofInput());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.item.serviceProofId).toBe('proof-001');
      expect(result.item.status).toBe('ready');
      expect(result.item.netAmountCents).toBeGreaterThan(0);
    }
  });

  it('7. Keine Abrechnungsposition ohne Leistungsnachweis', () => {
    const result = createBillableItemFromServiceProof(
      validProofInput({ serviceProofId: '', proofStatus: 'draft' }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Leistungsnachweis/);
    }
  });

  it('8. Vorbereitete Leistungsart blockiert produktive Abrechnung', () => {
    const rateCheck = assertServiceRateAvailable(TENANT_A, 'pflegeberatung', '2026-06-01');
    expect(rateCheck.ok).toBe(false);
    if (!rateCheck.ok) {
      expect(rateCheck.error).toMatch(/vorbereitet/);
    }
  });

  it('9. Fehlender Klient blockiert Validierung', () => {
    const report = createCareBillingValidationReport({
      tenantId: TENANT_A,
      clientId: null,
      hasServiceProof: true,
      serviceProofApproved: true,
      serviceAreaKey: 'betreuung',
      servicePeriodFrom: '2026-06-01',
      servicePeriodTo: '2026-06-01',
      hourlyRateNetCents: 3800,
      costCarrierProfileId: 'cc-1',
      recipientResolved: true,
      recipientType: 'pflegekasse',
      taxMode: 'ustg_4_16_exempt',
      taxConsistent: true,
    });
    expect(report.passed).toBe(false);
    expect(report.checks.find((c) => c.checkKey === 'klient')?.message).toBe(
      CARE_VALIDATION_MESSAGES.klientMissing,
    );
  });

  it('10. Unklarer Rechnungsempfänger blockiert', () => {
    const resolution = resolveBillingRecipient(
      [
        {
          id: 'rec-unclear',
          tenantId: TENANT_A,
          clientId: CLIENT,
          recipientType: 'unclear',
          fullName: '',
          street: '',
          zip: '',
          city: '',
          email: null,
          phone: null,
          isPrimary: true,
          costCarrierProfileId: null,
          notes: null,
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
      [],
      { billingType: 'pflegekasse' },
    );
    expect(resolution.resolved).toBe(false);
    expect(resolution.blockedReason).toMatch(/unklar/i);
  });

  it('11. Pflegekasse als Empfänger bei Kassenabrechnung', () => {
    const resolution = resolveBillingRecipient(
      [
        {
          id: 'rec-pk',
          tenantId: TENANT_A,
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
        },
      ],
      [],
      { billingType: 'pflegekasse' },
    );
    expect(resolution.resolved).toBe(true);
    expect(resolution.recipientType).toBe('pflegekasse');
  });

  it('12. §4 Nr. 16 UStG steuerfrei für Pflegeleistungen', () => {
    const tax = calculateCareBillingTax('ustg_4_16_exempt', 5700, 'Betreuung');
    expect(tax.taxAmountCents).toBe(0);
    expect(tax.taxNotice).toBe(USTG_4_16_NOTICE);
    expect(tax.taxConsistent).toBe(true);
  });

  it('13. 19 % USt für Selbstzahler bei steuerpflichtigem Mandanten', () => {
    upsertTenantTaxConfig(TENANT_A, { isTaxLiable: true });
    const mode = resolveTaxModeForService(TENANT_A, 'selbstzahlerleistungen', true);
    expect(mode).toBe('standard_vat_19');

    const tax = calculateCareBillingTax('standard_vat_19', 10000, 'Selbstzahler');
    expect(tax.taxAmountCents).toBe(1900);
    expect(tax.grossAmountCents).toBe(11900);
  });

  it('14. Kleinunternehmer-Modus vorbereitet', () => {
    upsertTenantTaxConfig(TENANT_A, { kleinunternehmerEnabled: true });
    const mode = resolveTaxModeForService(TENANT_A, 'betreuung', false);
    expect(mode).toBe('kleinunternehmer_19');

    const tax = calculateCareBillingTax('kleinunternehmer_19', 10000, 'Betreuung');
    expect(tax.taxNotice).toBe(KLEINUNTERNEHMER_NOTICE);
    expect(tax.taxAmountCents).toBe(0);
  });

  it('15. Rechnungsentwurf ohne Pflichtdaten blockiert Finalisierung', () => {
    const itemResult = createBillableItemFromServiceProof(validProofInput());
    expect(itemResult.ok).toBe(true);
    if (!itemResult.ok) return;

    const draftResult = createCareInvoiceDraft({
      tenantId: TENANT_A,
      clientId: CLIENT,
      billableItemIds: [itemResult.item.id],
      servicePeriodFrom: '2026-06-01',
      servicePeriodTo: '2026-06-30',
    });
    expect(draftResult.ok).toBe(true);
    if (!draftResult.ok) return;

    const finalize = finalizeCareInvoiceDraft(TENANT_A, draftResult.draft.id);
    expect(finalize.ok).toBe(false);
    expect(finalize.blockedReason).toMatch(/Vorschau/);
  });

  it('16. Mandantenisolation — Tenant B sieht keine Daten von Tenant A', () => {
    createBillableItemFromServiceProof(validProofInput());
    seedTenantFixtures(TENANT_B);

    expect(listBillableItems(TENANT_A).length).toBe(1);
    expect(listBillableItems(TENANT_B).length).toBe(0);
  });

  it('parseCareGrade erkennt PG-Varianten', () => {
    expect(parseCareGrade('PG 2')).toBe('pg2');
    expect(parseCareGrade('pg5')).toBe('pg5');
    expect(parseCareGrade('invalid')).toBeNull();
  });
});
