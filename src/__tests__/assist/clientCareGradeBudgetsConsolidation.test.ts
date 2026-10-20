import { describe, expect, it } from 'vitest';
import {
  computeBudgetRecalculationDiffs,
  type BudgetRecalcDiff,
} from '@/lib/assist/clientCareGradeBudgetsService';
import {
  buildAnspruchsOverviewItems,
  buildCompactBillingRules,
  hasAnspruchsData,
  hasRecalculationChanges,
  parseCorrectionAmountCents,
  resolvePflegegradBudgetsTabAlias,
  validateBudgetCorrectionForm,
} from '@/lib/assist/clientCareGradeBudgetsViewModel';
import {
  getClientRecordTabsForClientContext,
  resolveClientRecordTabKey,
} from '@/lib/clients/clientIntakeFieldRules';
import type {
  BudgetTemplateCatalogEntry,
  ClientAssistBillingProfile,
  ClientBudgetAccount,
  ClientBillingPriorityRule,
  ClientCareEntitlement,
} from '@/types/assist/clientAssistBilling';

function mockAccount(overrides: Partial<ClientBudgetAccount> & Pick<ClientBudgetAccount, 'id' | 'catalogKey'>): ClientBudgetAccount {
  return {
    tenantId: 't1',
    clientId: 'c1',
    catalogTemplateId: null,
    catalogYear: 2026,
    period: 'monthly',
    periodStart: '2026-01-01',
    periodEnd: '2026-12-31',
    allocatedCents: 13100,
    usedCents: 0,
    reservedCents: 0,
    isIndividualOverride: false,
    individualAmountCents: null,
    standardAmountCents: 13100,
    locked: false,
    lockReason: null,
    isEnabled: true,
    catalogSnapshot: {},
    billingPriority: 1,
    status: 'active',
    notes: null,
    remainingCents: 13100,
    autoGenerate: true,
    ...overrides,
  };
}

function mockTemplate(
  overrides: Partial<BudgetTemplateCatalogEntry> & Pick<BudgetTemplateCatalogEntry, 'id' | 'catalogKey'>,
): BudgetTemplateCatalogEntry {
  return {
    budgetYear: 2026,
    label: overrides.catalogKey,
    description: null,
    period: 'monthly',
    defaultAmountCents: 13100,
    careGradeMin: 'pg1',
    careGradeMax: 'pg5',
    billingPriority: 1,
    allowsIndividualOverride: true,
    autoGenerate: true,
    isStatutory: true,
    metadata: {},
    isActive: true,
    ...overrides,
  };
}

function mockEntitlement(overrides: Partial<ClientCareEntitlement> = {}): ClientCareEntitlement {
  return {
    id: 'ent-1',
    tenantId: 't1',
    clientId: 'c1',
    careGrade: 'pg3',
    validFrom: '2026-01-01',
    validUntil: null,
    conversionEnabled: true,
    careFundName: 'AOK',
    careFundMemberId: '123',
    mdAssessmentDate: null,
    notes: null,
    source: 'test',
    ...overrides,
  };
}

function mockPriorityRule(
  overrides: Partial<ClientBillingPriorityRule> & Pick<ClientBillingPriorityRule, 'id' | 'catalogKey'>,
): ClientBillingPriorityRule {
  return {
    tenantId: 't1',
    clientId: 'c1',
    priorityOrder: 1,
    isActive: true,
    notes: null,
    ...overrides,
  };
}

function minimalProfile(overrides: Partial<ClientAssistBillingProfile> = {}): ClientAssistBillingProfile {
  return {
    asOfDate: '2026-06-01',
    budgetYear: 2026,
    careGrade: 'pg3',
    careEntitlement: mockEntitlement(),
    conversionEligible: true,
    carePreventionMode: 'separate_preventive_short_term',
    serviceEntitlements: [],
    budgetAccounts: [],
    priorityRules: [],
    warnings: [],
    templates: [],
    canUseBudgetByCatalogKey: {},
    ...overrides,
  };
}

describe('Pflegegrad & Budgets consolidation', () => {
  it('navigation shows single pflegegrad_budgets tab for ambulatory care', () => {
    const tabs = getClientRecordTabsForClientContext(['ambulatory_care']);
    expect(tabs).toContain('pflegegrad_budgets');
    expect(tabs).not.toContain('pflegegrad_anspruch');
    expect(tabs).not.toContain('leistungen_abrechnung');
    expect(tabs).not.toContain('budgetverlauf');
    expect(tabs).not.toContain('warnungen');
  });

  it('legacy tab deep links resolve to pflegegrad_budgets', () => {
    expect(resolveClientRecordTabKey('budget')).toBe('pflegegrad_budgets');
    expect(resolveClientRecordTabKey('budgetverlauf')).toBe('pflegegrad_budgets');
    expect(resolveClientRecordTabKey('warnungen')).toBe('pflegegrad_budgets');
    expect(resolveClientRecordTabKey('pflegegrad_anspruch')).toBe('pflegegrad_budgets');
    expect(resolvePflegegradBudgetsTabAlias('leistungen_abrechnung')).toBe('pflegegrad_budgets');
  });

  it('Anspruchsübersicht derives from budget accounts when no service entitlements', () => {
    const profile = minimalProfile({
      budgetAccounts: [
        mockAccount({
          id: 'acc-1',
          catalogKey: 'paragraph_45b',
          label: '§45b Entlastungsbudget',
        }),
      ],
      canUseBudgetByCatalogKey: { paragraph_45b: true },
    });

    expect(hasAnspruchsData(profile)).toBe(true);
    const items = buildAnspruchsOverviewItems(profile);
    expect(items).toHaveLength(1);
    expect(items[0].title).toContain('§45b');
    expect(items[0].source).toBe('budget');
  });

  it('Anspruchsübersicht falls back to statutory templates before empty state', () => {
    const profile = minimalProfile({
      templates: [
        mockTemplate({
          id: 'tpl-1',
          catalogKey: 'paragraph_45b',
          label: '§45b Entlastungsbudget',
        }),
      ],
    });

    expect(hasAnspruchsData(profile)).toBe(true);
    expect(buildAnspruchsOverviewItems(profile)[0].source).toBe('template');
  });

  it('compact billing rules deduplicate priority entries', () => {
    const profile = minimalProfile({
      budgetAccounts: [mockAccount({ id: 'a1', catalogKey: 'paragraph_45b' })],
      priorityRules: [
        mockPriorityRule({ id: 'p1', catalogKey: 'paragraph_45b', priorityOrder: 1 }),
        mockPriorityRule({ id: 'p2', catalogKey: 'paragraph_45b', priorityOrder: 1 }),
        mockPriorityRule({ id: 'p3', catalogKey: 'verhinderungspflege', priorityOrder: 3 }),
      ],
      canUseBudgetByCatalogKey: { paragraph_45b: true, verhinderungspflege: false },
    });

    const rules = buildCompactBillingRules(profile);
    expect(rules).toHaveLength(1);
    expect(rules[0].catalogKey).toBe('paragraph_45b');
  });
});

describe('Phase 2 — correction & recalculation logic', () => {
  it('validateBudgetCorrectionForm rejects empty reason and zero amount', () => {
    expect(
      validateBudgetCorrectionForm({
        budgetAccountId: 'a1',
        amountEuro: '0',
        reason: '',
        effectiveDate: '2026-06-01',
      }).ok,
    ).toBe(false);

    expect(
      validateBudgetCorrectionForm({
        budgetAccountId: 'a1',
        amountEuro: '25,50',
        reason: 'Korrektur laut Bescheid',
        effectiveDate: '2026-06-01',
      }).ok,
    ).toBe(true);
  });

  it('parseCorrectionAmountCents handles german decimal comma', () => {
    expect(parseCorrectionAmountCents('-12,50')).toBe(-1250);
    expect(parseCorrectionAmountCents('100')).toBe(10000);
  });

  it('computeBudgetRecalculationDiffs skips individual overrides', () => {
    const templates = [
      mockTemplate({ id: 't1', catalogKey: 'paragraph_45b', defaultAmountCents: 13100 }),
      mockTemplate({ id: 't2', catalogKey: 'umwandlung_pg3', defaultAmountCents: 59800, careGradeMin: 'pg3', careGradeMax: 'pg3' }),
    ];

    const diffs = computeBudgetRecalculationDiffs({
      careGrade: 'pg3',
      conversionEligible: true,
      careEntitlement: mockEntitlement({ conversionEnabled: true }),
      budgetAccounts: [
        mockAccount({ id: 'a1', catalogKey: 'paragraph_45b', allocatedCents: 12000, standardAmountCents: 13100 }),
        mockAccount({
          id: 'a2',
          catalogKey: 'umwandlung_pg3',
          allocatedCents: 55000,
          isIndividualOverride: true,
          individualAmountCents: 55000,
        }),
      ],
      templates,
    });

    expect(diffs.find((d) => d.catalogKey === 'paragraph_45b')?.deltaCents).toBe(1100);
    expect(diffs.find((d) => d.catalogKey === 'umwandlung_pg3')?.skipped).toBe(true);
  });

  it('computeBudgetRecalculationDiffs excludes umwandlung when conversion off', () => {
    const templates = [
      mockTemplate({ id: 't1', catalogKey: 'paragraph_45b' }),
      mockTemplate({ id: 't2', catalogKey: 'umwandlung_pg3', careGradeMin: 'pg3', careGradeMax: 'pg3', defaultAmountCents: 59800 }),
    ];

    const diffs = computeBudgetRecalculationDiffs({
      careGrade: 'pg3',
      conversionEligible: true,
      careEntitlement: mockEntitlement({ conversionEnabled: false }),
      budgetAccounts: [
        mockAccount({ id: 'a1', catalogKey: 'paragraph_45b' }),
        mockAccount({ id: 'a2', catalogKey: 'umwandlung_pg3', allocatedCents: 50000 }),
      ],
      templates,
    });

    expect(diffs.some((d) => d.catalogKey === 'umwandlung_pg3')).toBe(false);
  });

  it('hasRecalculationChanges detects applicable diffs', () => {
    const diffs: BudgetRecalcDiff[] = [
      {
        accountId: 'a1',
        catalogKey: 'paragraph_45b',
        label: '§45b',
        currentAllocatedCents: 12000,
        catalogAmountCents: 13100,
        deltaCents: 1100,
        skipped: false,
      },
      {
        accountId: 'a2',
        catalogKey: 'umwandlung_pg3',
        label: 'Umw.',
        currentAllocatedCents: 59800,
        catalogAmountCents: 59800,
        deltaCents: 0,
        skipped: true,
        skipReason: 'Keine Abweichung',
      },
    ];

    expect(hasRecalculationChanges(diffs)).toBe(true);
    expect(hasRecalculationChanges(diffs.filter((d) => d.skipped))).toBe(false);
  });
});
