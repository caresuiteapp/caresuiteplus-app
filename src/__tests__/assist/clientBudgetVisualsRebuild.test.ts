import { describe, expect, it } from 'vitest';
import {
  buildClientBudgetVisualModels,
  calculateRemainingCareAllowanceCents,
  CARE_BUDGET_VALUES_2026,
} from '@/lib/assist/clientBudgetVisuals';
import type {
  BudgetTemplateCatalogEntry,
  ClientAssistBillingProfile,
  ClientBudgetAccount,
} from '@/types/assist/clientAssistBilling';

function account(input: Partial<ClientBudgetAccount> & Pick<ClientBudgetAccount, 'id' | 'catalogKey'>): ClientBudgetAccount {
  return {
    tenantId: 'tenant-1',
    clientId: 'client-1',
    catalogTemplateId: null,
    catalogYear: 2026,
    period: 'monthly',
    periodStart: '2026-08-01',
    periodEnd: '2027-06-30',
    allocatedCents: 13_100,
    usedCents: 0,
    reservedCents: 0,
    externalSachleistungCents: 0,
    isIndividualOverride: false,
    individualAmountCents: null,
    standardAmountCents: 13_100,
    locked: false,
    lockReason: null,
    isEnabled: true,
    catalogSnapshot: {},
    billingPriority: 1,
    status: 'active',
    notes: null,
    ...input,
  };
}

function template(catalogKey: string, amount: number): BudgetTemplateCatalogEntry {
  return {
    id: `template-${catalogKey}`,
    catalogKey,
    budgetYear: 2026,
    label: catalogKey,
    description: null,
    period: 'monthly',
    defaultAmountCents: amount,
    careGradeMin: 'pg1',
    careGradeMax: 'pg5',
    billingPriority: 1,
    allowsIndividualOverride: true,
    autoGenerate: true,
    isStatutory: true,
    metadata: {},
    isActive: true,
  };
}

function profile(overrides: Partial<ClientAssistBillingProfile> = {}): ClientAssistBillingProfile {
  return {
    asOfDate: '2026-08-04',
    budgetYear: 2026,
    careGrade: 'pg2',
    careEntitlement: {
      id: 'care-1',
      tenantId: 'tenant-1',
      clientId: 'client-1',
      careGrade: 'pg2',
      validFrom: '2026-01-01',
      validUntil: null,
      conversionEnabled: false,
      careFundName: 'Pflegekasse',
      careFundMemberId: null,
      mdAssessmentDate: null,
      notes: null,
      source: 'manual',
    },
    conversionEligible: false,
    carePreventionMode: 'separate_preventive_short_term',
    serviceEntitlements: [{
      id: 'service-1', tenantId: 'tenant-1', clientId: 'client-1', serviceTypeId: null,
      serviceTypeKey: 'assist', billingMode: 'cost_carrier', isActive: true,
      validFrom: '2026-01-01', validUntil: null, hourlyRateCents: 3_275, notes: null,
    }],
    budgetAccounts: [],
    budgetVisualAccounts: [],
    priorityRules: [],
    warnings: [],
    templates: [
      template('paragraph_45b', 13_100),
      template('umwandlung_pg2', 31_840),
    ],
    canUseBudgetByCatalogKey: {},
    ...overrides,
  };
}

describe('rebuilt client budget visuals', () => {
  it('always returns both Entlastungsbetrag and conversion cards', () => {
    const cards = buildClientBudgetVisualModels(profile());
    expect(cards.map((card) => card.id)).toEqual(['entlastung', 'umwandlung']);
    expect(cards[1].enabled).toBe(false);
    expect(cards[1].statusLabel).toContain('Noch nicht aktiviert');
  });

  it('converts remaining budget into hours using the actual hourly rate', () => {
    const [entlastung] = buildClientBudgetVisualModels(profile());
    expect(entlastung.totalCents).toBe(13_100);
    expect(entlastung.availableHours).toBe(4);
  });

  it('aggregates multiple still-valid §45b carry-over buckets', () => {
    const jan = account({ id: 'jan', catalogKey: 'paragraph_45b', periodStart: '2026-01-01', allocatedCents: 13_100, usedCents: 3_100 });
    const feb = account({ id: 'feb', catalogKey: 'paragraph_45b', periodStart: '2026-02-01', allocatedCents: 13_100, reservedCents: 3_275 });
    const [entlastung] = buildClientBudgetVisualModels(profile({ budgetAccounts: [feb], budgetVisualAccounts: [jan, feb] }));
    expect(entlastung.totalCents).toBe(26_200);
    expect(entlastung.usedCents).toBe(3_100);
    expect(entlastung.reservedCents).toBe(3_275);
    expect(entlastung.availableCents).toBe(19_825);
  });

  it('uses exact 2026 conversion amounts without euro truncation', () => {
    expect(CARE_BUDGET_VALUES_2026.pg2.conversionCents).toBe(31_840);
    expect(CARE_BUDGET_VALUES_2026.pg3.conversionCents).toBe(59_880);
    expect(CARE_BUDGET_VALUES_2026.pg4.conversionCents).toBe(74_360);
    expect(CARE_BUDGET_VALUES_2026.pg5.conversionCents).toBe(91_960);
  });

  it('reduces forecast care allowance by conversion and external §36 usage', () => {
    expect(calculateRemainingCareAllowanceCents({ careGrade: 'pg2', conversionUsedCents: 31_840 })).toBe(20_820);
    expect(calculateRemainingCareAllowanceCents({ careGrade: 'pg2', conversionUsedCents: 0, externalSachleistungCents: 39_800 })).toBe(17_350);
  });

  it('keeps individual administration override as the visible total', () => {
    const custom = account({
      id: 'custom',
      catalogKey: 'paragraph_45b',
      allocatedCents: 65_500,
      individualAmountCents: 65_500,
      isIndividualOverride: true,
    });
    const [entlastung] = buildClientBudgetVisualModels(profile({ budgetAccounts: [custom], budgetVisualAccounts: [custom] }));
    expect(entlastung.totalCents).toBe(65_500);
    expect(entlastung.statusLabel).toBe('Individueller Gesamtbetrag');
  });
});
