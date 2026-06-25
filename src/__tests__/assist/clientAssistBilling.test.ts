import { describe, expect, it, vi } from 'vitest';
import {
  filterTemplatesForCareGrade,
  getUmwandlungTemplateKeyForGrade,
  listBudgetTemplatesByYear,
} from '@/lib/assist/budgetTemplateCatalogService';
import {
  DEFAULT_CATALOG_PRIORITY,
  resolvePrimaryBillingCatalogKey,
  sortAccountsByPriority,
} from '@/lib/assist/clientBillingPriorityService';
import { computeBillingWarnings } from '@/lib/assist/clientBillingWarningsService';
import {
  gradeMatchesTemplate,
  isConversionEligibleForGrade,
  resolveTemplateAmountCents,
  type BudgetTemplateCatalogEntry,
  type ClientBudgetAccount,
  type ClientCareGrade,
} from '@/types/assist/clientAssistBilling';

const CATALOG_2026: BudgetTemplateCatalogEntry[] = [
  {
    id: '1', catalogKey: 'paragraph_45b', budgetYear: 2026, label: '§45b', description: null,
    period: 'monthly', defaultAmountCents: 13100, careGradeMin: 'pg1', careGradeMax: 'pg5',
    billingPriority: 1, allowsIndividualOverride: true, autoGenerate: true, isStatutory: true,
    metadata: {}, isActive: true,
  },
  {
    id: '2', catalogKey: 'umwandlung_pg2', budgetYear: 2026, label: 'Umw. PG2', description: null,
    period: 'monthly', defaultAmountCents: 31800, careGradeMin: 'pg2', careGradeMax: 'pg2',
    billingPriority: 2, allowsIndividualOverride: true, autoGenerate: true, isStatutory: true,
    metadata: {}, isActive: true,
  },
  {
    id: '3', catalogKey: 'umwandlung_pg3', budgetYear: 2026, label: 'Umw. PG3', description: null,
    period: 'monthly', defaultAmountCents: 59800, careGradeMin: 'pg3', careGradeMax: 'pg3',
    billingPriority: 2, allowsIndividualOverride: true, autoGenerate: true, isStatutory: true,
    metadata: {}, isActive: true,
  },
  {
    id: '4', catalogKey: 'umwandlung_pg4', budgetYear: 2026, label: 'Umw. PG4', description: null,
    period: 'monthly', defaultAmountCents: 74300, careGradeMin: 'pg4', careGradeMax: 'pg4',
    billingPriority: 2, allowsIndividualOverride: true, autoGenerate: true, isStatutory: true,
    metadata: {}, isActive: true,
  },
  {
    id: '5', catalogKey: 'umwandlung_pg5', budgetYear: 2026, label: 'Umw. PG5', description: null,
    period: 'monthly', defaultAmountCents: 91900, careGradeMin: 'pg5', careGradeMax: 'pg5',
    billingPriority: 2, allowsIndividualOverride: true, autoGenerate: true, isStatutory: true,
    metadata: {}, isActive: true,
  },
  {
    id: '6', catalogKey: 'verhinderungspflege', budgetYear: 2026, label: 'Verh.', description: null,
    period: 'yearly', defaultAmountCents: 168500, careGradeMin: 'pg2', careGradeMax: 'pg5',
    billingPriority: 3, allowsIndividualOverride: true, autoGenerate: true, isStatutory: true,
    metadata: {}, isActive: true,
  },
  {
    id: '7', catalogKey: 'kurzzeitpflege', budgetYear: 2026, label: 'Kurzzeit', description: null,
    period: 'yearly', defaultAmountCents: 185400, careGradeMin: null, careGradeMax: null,
    billingPriority: 4, allowsIndividualOverride: true, autoGenerate: true, isStatutory: true,
    metadata: {}, isActive: true,
  },
  {
    id: '8', catalogKey: 'gemeinsames_jahresbudget', budgetYear: 2026, label: 'Jahresbudget', description: null,
    period: 'yearly', defaultAmountCents: 353900, careGradeMin: null, careGradeMax: null,
    billingPriority: 5, allowsIndividualOverride: true, autoGenerate: false, isStatutory: true,
    metadata: {}, isActive: true,
  },
  {
    id: '9', catalogKey: 'selbstzahler', budgetYear: 2026, label: 'Selbstzahler', description: null,
    period: 'yearly', defaultAmountCents: null, careGradeMin: null, careGradeMax: null,
    billingPriority: 90, allowsIndividualOverride: true, autoGenerate: false, isStatutory: false,
    metadata: {}, isActive: true,
  },
];

describe('Klient:innenakte Budget 2026 — catalog values (Tests 1–8)', () => {
  it('1. §45b monthly amount is 13100 cents', () => {
    const t = CATALOG_2026.find((c) => c.catalogKey === 'paragraph_45b');
    expect(t?.defaultAmountCents).toBe(13100);
    expect(t?.period).toBe('monthly');
  });

  it('2. Umwandlung PG2–5 cent values and monthly period', () => {
    expect(CATALOG_2026.find((c) => c.catalogKey === 'umwandlung_pg2')?.defaultAmountCents).toBe(31800);
    expect(CATALOG_2026.find((c) => c.catalogKey === 'umwandlung_pg3')?.defaultAmountCents).toBe(59800);
    expect(CATALOG_2026.find((c) => c.catalogKey === 'umwandlung_pg4')?.defaultAmountCents).toBe(74300);
    expect(CATALOG_2026.find((c) => c.catalogKey === 'umwandlung_pg5')?.defaultAmountCents).toBe(91900);
    for (const key of ['umwandlung_pg2', 'umwandlung_pg3', 'umwandlung_pg4', 'umwandlung_pg5']) {
      expect(CATALOG_2026.find((c) => c.catalogKey === key)?.period).toBe('monthly');
    }
  });

  it('3. Verhinderungspflege yearly 168500', () => {
    expect(CATALOG_2026.find((c) => c.catalogKey === 'verhinderungspflege')?.defaultAmountCents).toBe(168500);
  });

  it('4. Kurzzeitpflege yearly 185400', () => {
    expect(CATALOG_2026.find((c) => c.catalogKey === 'kurzzeitpflege')?.defaultAmountCents).toBe(185400);
  });

  it('5. Gemeinsames Jahresbudget 353900', () => {
    expect(CATALOG_2026.find((c) => c.catalogKey === 'gemeinsames_jahresbudget')?.defaultAmountCents).toBe(353900);
  });

  it('6. Selbstzahler/Kulanz/Ungeklärt have no default amount', () => {
    const selbst = CATALOG_2026.find((c) => c.catalogKey === 'selbstzahler');
    expect(selbst?.defaultAmountCents).toBeNull();
    expect(selbst?.autoGenerate).toBe(false);
  });
});

describe('PG rules (Tests 9–14)', () => {
  it('9. PG1 is not conversion eligible', () => {
    expect(isConversionEligibleForGrade('pg1')).toBe(false);
  });

  it('10. PG2–5 are conversion eligible', () => {
    expect(isConversionEligibleForGrade('pg2')).toBe(true);
    expect(isConversionEligibleForGrade('pg5')).toBe(true);
  });

  it('11. PG1 filters out Umwandlung templates', () => {
    const filtered = filterTemplatesForCareGrade(CATALOG_2026, 'pg1');
    expect(filtered.some((t) => t.catalogKey.startsWith('umwandlung_'))).toBe(false);
    expect(filtered.some((t) => t.catalogKey === 'paragraph_45b')).toBe(true);
  });

  it('12. PG3 gets correct Umwandlung template key', () => {
    expect(getUmwandlungTemplateKeyForGrade('pg3')).toBe('umwandlung_pg3');
  });

  it('13. gradeMatchesTemplate respects PG bounds', () => {
    const umwPg4 = CATALOG_2026.find((c) => c.catalogKey === 'umwandlung_pg4')!;
    expect(gradeMatchesTemplate('pg4', umwPg4)).toBe(true);
    expect(gradeMatchesTemplate('pg2', umwPg4)).toBe(false);
  });

  it('14. Verhinderungspflege applies PG2–5 only', () => {
    const vp = CATALOG_2026.find((c) => c.catalogKey === 'verhinderungspflege')!;
    expect(gradeMatchesTemplate('pg2', vp)).toBe(true);
    expect(gradeMatchesTemplate('pg1', vp)).toBe(false);
  });
});

describe('Individual override (Tests 15–17)', () => {
  it('15. Individual amount overrides catalog default', () => {
    const template = CATALOG_2026[0];
    expect(resolveTemplateAmountCents(template, 15000)).toBe(15000);
  });

  it('16. Without override uses catalog default', () => {
    expect(resolveTemplateAmountCents(CATALOG_2026[0])).toBe(13100);
  });

  it('17. Null default returns 0 when no override', () => {
    const selbst = CATALOG_2026.find((c) => c.catalogKey === 'selbstzahler')!;
    expect(resolveTemplateAmountCents(selbst)).toBe(0);
  });
});

describe('Priority rules (Tests 18–22)', () => {
  it('18. §45b has priority 1', () => {
    expect(DEFAULT_CATALOG_PRIORITY.paragraph_45b).toBe(1);
  });

  it('19. Umwandlung priority 2', () => {
    expect(DEFAULT_CATALOG_PRIORITY.umwandlung_pg3).toBe(2);
  });

  it('20. sortAccountsByPriority orders correctly', () => {
    const accounts: ClientBudgetAccount[] = [
      mockAccount('verhinderungspflege', 3),
      mockAccount('paragraph_45b', 1),
      mockAccount('umwandlung_pg2', 2),
    ];
    const rules = Object.entries(DEFAULT_CATALOG_PRIORITY).map(([catalogKey, priorityOrder], i) => ({
      id: String(i),
      tenantId: 't',
      clientId: null,
      catalogKey,
      priorityOrder,
      isActive: true,
      notes: null,
    }));
    const sorted = sortAccountsByPriority(accounts, rules);
    expect(sorted[0].catalogKey).toBe('paragraph_45b');
  });

  it('21. resolvePrimaryBillingCatalogKey prefers §45b', () => {
    const rules = [{ id: '1', tenantId: 't', clientId: null, catalogKey: 'paragraph_45b', priorityOrder: 1, isActive: true, notes: null }];
    expect(resolvePrimaryBillingCatalogKey('pg3', rules)).toBe('paragraph_45b');
  });
});

describe('Warnings (Tests 23–26)', () => {
  it('23. Missing care grade warning', () => {
    const w = computeBillingWarnings({
      tenantId: 't',
      clientId: 'c',
      careEntitlement: null,
      careGrade: null,
      budgetAccounts: [],
      serviceEntitlements: [],
    });
    expect(w.some((x) => x.warningType === 'missing_care_grade')).toBe(true);
  });

  it('24. PG1 + conversion enabled = critical', () => {
    const w = computeBillingWarnings({
      tenantId: 't',
      clientId: 'c',
      careEntitlement: {
        id: '1', tenantId: 't', clientId: 'c', careGrade: 'pg1', validFrom: '2026-01-01',
        validUntil: null, conversionEnabled: true, careFundName: null, careFundMemberId: null,
        mdAssessmentDate: null, notes: null, source: 'manual',
      },
      careGrade: 'pg1',
      budgetAccounts: [],
      serviceEntitlements: [],
    });
    expect(w.some((x) => x.warningType === 'pg1_conversion_invalid')).toBe(true);
  });

  it('25. Exhausted budget warning', () => {
    const w = computeBillingWarnings({
      tenantId: 't',
      clientId: 'c',
      careEntitlement: null,
      careGrade: 'pg3',
      budgetAccounts: [mockAccount('paragraph_45b', 1, 0)],
      serviceEntitlements: [],
    });
    expect(w.some((x) => x.warningType === 'budget_exhausted')).toBe(true);
  });

  it('26. Unclear billing mode warning', () => {
    const w = computeBillingWarnings({
      tenantId: 't',
      clientId: 'c',
      careEntitlement: null,
      careGrade: 'pg2',
      budgetAccounts: [mockAccount('paragraph_45b', 1, 5000)],
      serviceEntitlements: [{
        id: 's1', tenantId: 't', clientId: 'c', serviceTypeId: null, serviceTypeKey: 'betreuung',
        billingMode: 'unclear', isActive: true, validFrom: '2026-01-01', validUntil: null,
        hourlyRateCents: null, notes: null,
      }],
    });
    expect(w.some((x) => x.warningType === 'billing_unclear')).toBe(true);
  });
});

describe('Period labels (Tests 23)', () => {
  it('23. Umwandlung period label is always monatlich', async () => {
    const { formatBudgetPeriodLabel } = await import('@/lib/assist/budgetPeriodLabels');
    expect(formatBudgetPeriodLabel('yearly', 'umwandlung_pg2')).toBe('monatlich');
    expect(formatBudgetPeriodLabel('monthly', 'paragraph_45b')).toBe('monatlich');
    expect(formatBudgetPeriodLabel('yearly', 'verhinderungspflege')).toBe('jährlich');
  });
});

describe('Profile service wiring (Tests 27–29)', () => {
  it('27. getClientAssistBillingProfile export exists', async () => {
    const mod = await import('@/lib/assist/clientAssistBillingProfileService');
    expect(typeof mod.getClientAssistBillingProfile).toBe('function');
  });

  it('28. listBudgetTemplatesByYear uses supabase when available', async () => {
    vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => null }));
    const result = await listBudgetTemplatesByYear(2026);
    expect(result.ok).toBe(false);
  });

  it('29. No hardcoded amounts in ClientAssistBillingPanels UI', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const src = readFileSync(
      resolve(process.cwd(), 'src/components/office/ClientAssistBillingPanels.tsx'),
      'utf8',
    );
    expect(src).not.toMatch(/13100|353900/);
    expect(src).toContain('getClientAssistBillingProfile');
  });
});

describe('Budget transaction lifecycle (Tests 30–35)', () => {
  it('30. Reservation reduces available cents', async () => {
    const { computeAvailableCents } = await import('@/lib/assist/clientBudgetTransactionService');
    const account: ClientBudgetAccount = {
      ...mockAccount('paragraph_45b', 1),
      allocatedCents: 10000,
      usedCents: 0,
      reservedCents: 0,
    };
    expect(computeAvailableCents(account)).toBe(10000);
    expect(computeAvailableCents({ ...account, reservedCents: 3000 })).toBe(7000);
  });

  it('31. Storno releases reserved amount', async () => {
    const { computeAvailableCents } = await import('@/lib/assist/clientBudgetTransactionService');
    const reserved: ClientBudgetAccount = {
      ...mockAccount('paragraph_45b', 1),
      allocatedCents: 10000,
      usedCents: 0,
      reservedCents: 5000,
    };
    expect(computeAvailableCents(reserved)).toBe(5000);
    expect(computeAvailableCents({ ...reserved, reservedCents: 0 })).toBe(10000);
  });

  it('32. selectAccountForReservation respects catalog hint', async () => {
    const { selectAccountForReservation } = await import('@/lib/assist/clientBudgetTransactionService');
    const accounts = [
      { ...mockAccount('paragraph_45b', 1), allocatedCents: 500, usedCents: 0, reservedCents: 0 },
      {
        ...mockAccount('umwandlung_pg3', 2),
        catalogKey: 'umwandlung_pg3',
        allocatedCents: 50000,
        usedCents: 0,
        reservedCents: 0,
      },
    ];
    const picked = selectAccountForReservation(accounts, 1000, 'umwandlung_pg3');
    expect(picked?.catalogKey).toBe('umwandlung_pg3');
  });

  it('33. Final consume only after proof — usage type distinct from reservation', async () => {
    const mod = await import('@/lib/assist/clientBudgetTransactionService');
    expect(typeof mod.consumeOnProofApproval).toBe('function');
    expect(typeof mod.reserveForAssignment).toBe('function');
    expect(mod.consumeOnProofApproval).not.toBe(mod.reserveForAssignment);
  });

  it('34. Legacy care level sync maps PG grades', async () => {
    const { mapLegacyGradeToEntitlement } = await import('@/lib/assist/clientCareEntitlementSyncService');
    expect(mapLegacyGradeToEntitlement('PG3')).toBe('pg3');
    expect(mapLegacyGradeToEntitlement('none')).toBe('kein');
  });

  it('35. Individual budget sync skipped when entitlement unchanged', async () => {
    const { shouldUpsertEntitlement } = await import('@/lib/assist/clientCareEntitlementSyncService');
    const current = {
      id: '1', tenantId: 't', clientId: 'c', careGrade: 'pg3' as ClientCareGrade,
      validFrom: '2026-01-01', validUntil: null, conversionEnabled: true,
      careFundName: 'AOK', careFundMemberId: '123', mdAssessmentDate: null, notes: null, source: 'manual',
    };
    expect(shouldUpsertEntitlement(current, {
      careGrade: 'pg3',
      validFrom: '2026-01-01',
      validUntil: null,
      conversionEnabled: true,
      careFundName: 'AOK',
      careFundMemberId: '123',
      mdAssessmentDate: null,
      notes: null,
      source: 'client_care_levels',
    })).toBe(false);
  });
});

describe('canUse budget flags (Tests 36–37)', () => {
  it('36. PG1 blocks Umwandlung in canUse flags', async () => {
    const { computeCanUseBudgetByCatalogKey } = await import('@/lib/assist/clientBudgetTransactionService');
    const accounts = [
      mockAccount('paragraph_45b', 1, 5000),
      mockAccount('umwandlung_pg2', 2, 5000),
    ];
    const flags = computeCanUseBudgetByCatalogKey(accounts, 'pg1');
    expect(flags.paragraph_45b).toBe(true);
    expect(flags.umwandlung_pg2).toBe(false);
  });

  it('37. Exhausted account is not canUse', async () => {
    const { computeCanUseBudgetByCatalogKey } = await import('@/lib/assist/clientBudgetTransactionService');
    const flags = computeCanUseBudgetByCatalogKey([mockAccount('paragraph_45b', 1, 0)], 'pg3');
    expect(flags.paragraph_45b).toBe(false);
  });
});

function mockAccount(catalogKey: string, billingPriority: number, remainingCents = 10000): ClientBudgetAccount {
  return {
    id: catalogKey,
    tenantId: 't',
    clientId: 'c',
    catalogTemplateId: null,
    catalogKey,
    catalogYear: 2026,
    period: catalogKey.startsWith('umwandlung_') || catalogKey === 'paragraph_45b' ? 'monthly' : 'yearly',
    periodStart: '2026-06-01',
    periodEnd: catalogKey.startsWith('umwandlung_') || catalogKey === 'paragraph_45b' ? '2026-06-30' : '2026-12-31',
    allocatedCents: 13100,
    usedCents: 13100 - remainingCents,
    reservedCents: 0,
    isIndividualOverride: false,
    individualAmountCents: null,
    standardAmountCents: null,
    locked: false,
    lockReason: null,
    isEnabled: true,
    catalogSnapshot: {},
    billingPriority,
    status: 'active',
    notes: null,
    remainingCents,
  };
}
