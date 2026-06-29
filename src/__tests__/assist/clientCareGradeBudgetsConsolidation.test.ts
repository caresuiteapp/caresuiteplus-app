import { describe, expect, it } from 'vitest';
import {
  buildAnspruchsOverviewItems,
  buildCompactBillingRules,
  hasAnspruchsData,
  resolvePflegegradBudgetsTabAlias,
} from '@/lib/assist/clientCareGradeBudgetsViewModel';
import {
  getClientRecordTabsForClientContext,
  resolveClientRecordTabKey,
} from '@/lib/clients/clientIntakeFieldRules';
import type {
  ClientAssistBillingProfile,
  ClientBudgetAccount,
  ClientBillingPriorityRule,
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
    careEntitlement: null,
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
        {
          id: 'tpl-1',
          catalogKey: 'paragraph_45b',
          budgetYear: 2026,
          label: '§45b Entlastungsbudget',
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
        },
      ],
    });

    expect(hasAnspruchsData(profile)).toBe(true);
    expect(buildAnspruchsOverviewItems(profile)[0].source).toBe('template');
  });

  it('compact billing rules deduplicate priority entries', () => {
    const profile = minimalProfile({
      budgetAccounts: [mockAccount({ id: 'a1', catalogKey: 'paragraph_45b', label: null })],
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
