import { describe, expect, it } from 'vitest';
import {
  calculateAssistBudgetAllocationFromProfile,
  calculateSeriesBudgetAllocations,
  computeAssignmentAmountCents,
  expandVisitRecurrenceDates,
} from '@/lib/assist/calculateAssistBudgetAllocation';
import { hasPermission } from '@/lib/permissions/check';
import type { ClientAssistBillingProfile, ClientBudgetAccount } from '@/types/assist/clientAssistBilling';

const HOURLY = 3275; // 32,75 €
const TWO_HOURS = 120;
const AMOUNT_6550 = computeAssignmentAmountCents(TWO_HOURS, HOURLY); // 65,50 €
const AMOUNT_13100 = computeAssignmentAmountCents(240, HOURLY); // 131,00 €

function account(
  partial: Partial<ClientBudgetAccount> & Pick<ClientBudgetAccount, 'catalogKey' | 'id'>,
): ClientBudgetAccount {
  return {
    tenantId: 't1',
    clientId: 'c1',
    catalogTemplateId: null,
    catalogYear: 2026,
    period: partial.catalogKey === 'paragraph_45b' || partial.catalogKey.startsWith('umwandlung_')
      ? 'monthly'
      : 'yearly',
    periodStart: '2026-07-01',
    periodEnd:
      partial.catalogKey === 'paragraph_45b' || partial.catalogKey.startsWith('umwandlung_')
        ? '2026-07-31'
        : '2026-12-31',
    allocatedCents: partial.allocatedCents ?? 13100,
    usedCents: partial.usedCents ?? 0,
    reservedCents: partial.reservedCents ?? 0,
    isIndividualOverride: false,
    individualAmountCents: null,
    standardAmountCents: null,
    locked: false,
    lockReason: null,
    isEnabled: true,
    catalogSnapshot: {},
    billingPriority: 1,
    status: 'active',
    notes: null,
    ...partial,
  };
}

function profile(
  careGrade: ClientAssistBillingProfile['careGrade'],
  accounts: ClientBudgetAccount[],
  extra?: Partial<ClientAssistBillingProfile>,
): ClientAssistBillingProfile {
  const canUse: Record<string, boolean> = {};
  for (const a of accounts) {
    canUse[a.catalogKey] = a.allocatedCents - a.usedCents - a.reservedCents > 0;
  }
  return {
    asOfDate: '2026-07-15',
    budgetYear: 2026,
    careGrade,
    careEntitlement: {
      id: 'e1',
      tenantId: 't1',
      clientId: 'c1',
      careGrade: careGrade ?? 'kein',
      validFrom: '2026-01-01',
      validUntil: null,
      conversionEnabled: extra?.conversionEligible ?? false,
      careFundName: 'Kasse',
      careFundMemberId: null,
      mdAssessmentDate: null,
      notes: null,
      source: 'test',
    },
    conversionEligible:
      extra?.conversionEligible
      ?? (careGrade === 'pg2'
        || careGrade === 'pg3'
        || careGrade === 'pg4'
        || careGrade === 'pg5'),
    carePreventionMode: extra?.carePreventionMode ?? 'separate_preventive_short_term',
    serviceEntitlements: extra?.serviceEntitlements ?? [],
    budgetAccounts: accounts,
    priorityRules: [],
    warnings: extra?.warnings ?? [],
    templates: [],
    canUseBudgetByCatalogKey: canUse,
  };
}

function allocate(p: ClientAssistBillingProfile, minutes = TWO_HOURS) {
  return calculateAssistBudgetAllocationFromProfile(p, {
    plannedStart: '09:00',
    plannedEnd: '11:00',
    plannedMinutes: minutes,
    hourlyRateCents: HOURLY,
    actorRoleKey: 'dispatch',
  });
}

describe('Einsatz-Budget-Automatik (Tests 1–19)', () => {
  it('1. PG1 nutzt §45b, danach Selbstzahler', () => {
    const p = profile('pg1', [
      account({ id: 'a45', catalogKey: 'paragraph_45b', allocatedCents: 6550 }),
      account({ id: 'as', catalogKey: 'selbstzahler', allocatedCents: 0 }),
    ]);
    const r = allocate(p);
    const used45 = r.allocationProposal.find((l) => l.catalogKey === 'paragraph_45b');
    expect(used45?.amountCents).toBe(6550);
    expect(r.selfPayerAmountCents).toBe(0);
    const p2 = profile('pg1', [
      account({ id: 'a45', catalogKey: 'paragraph_45b', allocatedCents: 0, usedCents: 13100 }),
      account({ id: 'as', catalogKey: 'selbstzahler', allocatedCents: 0 }),
    ], {
      serviceEntitlements: [{
        id: 's1', tenantId: 't1', clientId: 'c1', serviceTypeId: null, serviceTypeKey: null,
        billingMode: 'self_payer', isActive: true, validFrom: '2026-01-01', validUntil: null,
        hourlyRateCents: null, notes: null,
      }],
      canUseBudgetByCatalogKey: { paragraph_45b: false, selbstzahler: true },
    } as Partial<ClientAssistBillingProfile>);
    p2.canUseBudgetByCatalogKey = { paragraph_45b: false, selbstzahler: true };
    const r2 = allocate(p2);
    expect(r2.selfPayerAmountCents).toBe(AMOUNT_6550);
  });

  it('2. PG2 mit Umwandlung nach §45b', () => {
    const p = profile('pg2', [
      account({ id: 'a45', catalogKey: 'paragraph_45b', allocatedCents: 0, usedCents: 13100 }),
      account({ id: 'au', catalogKey: 'umwandlung_pg2', allocatedCents: 31800 }),
    ], { conversionEligible: true });
    p.careEntitlement!.conversionEnabled = true;
    const r = allocate(p);
    expect(r.allocationProposal.find((l) => l.catalogKey === 'umwandlung_pg2')?.amountCents).toBe(
      AMOUNT_6550,
    );
  });

  it('3. PG3 mit Umwandlung', () => {
    const p = profile('pg3', [
      account({ id: 'a45', catalogKey: 'paragraph_45b', allocatedCents: 0, usedCents: 13100 }),
      account({ id: 'au', catalogKey: 'umwandlung_pg3', allocatedCents: 59800 }),
    ], { conversionEligible: true });
    p.careEntitlement!.conversionEnabled = true;
    const r = allocate(p);
    expect(r.allocationProposal.find((l) => l.catalogKey === 'umwandlung_pg3')?.amountCents).toBe(
      AMOUNT_6550,
    );
  });

  it('4. PG4 mit Umwandlung', () => {
    const p = profile('pg4', [
      account({ id: 'a45', catalogKey: 'paragraph_45b', allocatedCents: 0, usedCents: 13100 }),
      account({ id: 'au', catalogKey: 'umwandlung_pg4', allocatedCents: 74300 }),
    ], { conversionEligible: true });
    p.careEntitlement!.conversionEnabled = true;
    const r = allocate(p);
    expect(r.allocationProposal.find((l) => l.catalogKey === 'umwandlung_pg4')?.amountCents).toBe(
      AMOUNT_6550,
    );
  });

  it('5. PG5 mit Umwandlung', () => {
    const p = profile('pg5', [
      account({ id: 'a45', catalogKey: 'paragraph_45b', allocatedCents: 0, usedCents: 13100 }),
      account({ id: 'au', catalogKey: 'umwandlung_pg5', allocatedCents: 91900 }),
    ], { conversionEligible: true });
    p.careEntitlement!.conversionEnabled = true;
    const r = allocate(p);
    expect(r.allocationProposal.find((l) => l.catalogKey === 'umwandlung_pg5')?.amountCents).toBe(
      AMOUNT_6550,
    );
  });

  it('6. Umwandlung ohne Aktivierung wird nicht verwendet', () => {
    const p = profile('pg3', [
      account({ id: 'a45', catalogKey: 'paragraph_45b', allocatedCents: 0, usedCents: 13100 }),
      account({ id: 'au', catalogKey: 'umwandlung_pg3', allocatedCents: 59800 }),
    ], { conversionEligible: false });
    p.careEntitlement!.conversionEnabled = false;
    const r = allocate(p);
    expect(r.allocationProposal.find((l) => l.catalogKey === 'umwandlung_pg3')?.status).toBe(
      'blocked',
    );
  });

  it('7. Verhinderungspflege ohne Freigabe blockiert', () => {
    const p = profile('pg3', [
      account({ id: 'a45', catalogKey: 'paragraph_45b', allocatedCents: 0, usedCents: 13100 }),
      account({ id: 'av', catalogKey: 'verhinderungspflege', allocatedCents: 168500 }),
    ], { conversionEligible: false });
    const r = allocate(p);
    const line = r.allocationProposal.find((l) => l.catalogKey === 'verhinderungspflege');
    expect(line?.status === 'blocked' || line?.amountCents === 0).toBe(true);
  });

  it('8. Verhinderungspflege mit Freigabe nach §45b und Umwandlung', () => {
    const p = profile('pg3', [
      account({ id: 'a45', catalogKey: 'paragraph_45b', allocatedCents: 0, usedCents: 13100 }),
      account({ id: 'au', catalogKey: 'umwandlung_pg3', allocatedCents: 0, usedCents: 59800 }),
      account({ id: 'av', catalogKey: 'verhinderungspflege', allocatedCents: 168500 }),
    ], {
      conversionEligible: true,
      serviceEntitlements: [{
        id: 's1', tenantId: 't1', clientId: 'c1', serviceTypeId: null,
        serviceTypeKey: 'verhinderungspflege', billingMode: 'cost_carrier', isActive: true,
        validFrom: '2026-01-01', validUntil: null, hourlyRateCents: null, notes: null,
      }],
    });
    p.careEntitlement!.conversionEnabled = true;
    const r = allocate(p);
    expect(r.allocationProposal.find((l) => l.catalogKey === 'verhinderungspflege')?.amountCents).toBe(
      AMOUNT_6550,
    );
  });

  it('9. Gemeinsames Jahresbudget statt doppelter Verhinderung/Kurzzeit', () => {
    const p = profile('pg3', [
      account({ id: 'a45', catalogKey: 'paragraph_45b', allocatedCents: 0, usedCents: 13100 }),
      account({ id: 'aj', catalogKey: 'gemeinsames_jahresbudget', allocatedCents: 353900 }),
      account({ id: 'av', catalogKey: 'verhinderungspflege', allocatedCents: 168500 }),
    ], {
      serviceEntitlements: [{
        id: 's1', tenantId: 't1', clientId: 'c1', serviceTypeId: null,
        serviceTypeKey: 'gemeinsames_jahresbudget', billingMode: 'cost_carrier', isActive: true,
        validFrom: '2026-01-01', validUntil: null, hourlyRateCents: null, notes: null,
      }],
    });
    const r = allocate(p);
    expect(r.allocationProposal.some((l) => l.catalogKey === 'gemeinsames_jahresbudget' && l.amountCents > 0)).toBe(true);
    expect(r.allocationProposal.find((l) => l.catalogKey === 'verhinderungspflege')?.amountCents ?? 0).toBe(0);
  });

  it('10. Selbstzahleranteil bei erschöpften Budgets', () => {
    const p = profile('pg2', [
      account({ id: 'a45', catalogKey: 'paragraph_45b', allocatedCents: 0, usedCents: 13100 }),
      account({ id: 'au', catalogKey: 'umwandlung_pg2', allocatedCents: 0, usedCents: 31800 }),
    ], {
      conversionEligible: true,
      serviceEntitlements: [{
        id: 's1', tenantId: 't1', clientId: 'c1', serviceTypeId: null, serviceTypeKey: null,
        billingMode: 'self_payer', isActive: true, validFrom: '2026-01-01', validUntil: null,
        hourlyRateCents: null, notes: null,
      }],
    });
    p.careEntitlement!.conversionEnabled = true;
    p.canUseBudgetByCatalogKey = { paragraph_45b: false, umwandlung_pg2: false, selbstzahler: true };
    const r = allocate(p);
    expect(r.selfPayerAmountCents).toBe(AMOUNT_6550);
  });

  it('11. Selbstzahler ohne Vereinbarung erzeugt Warnung', () => {
    const p = profile('pg1', [
      account({ id: 'a45', catalogKey: 'paragraph_45b', allocatedCents: 0, usedCents: 13100 }),
    ]);
    p.canUseBudgetByCatalogKey = { paragraph_45b: false };
    const r = allocate(p);
    expect(r.warnings.some((w) => w.includes('Selbstzahlervereinbarung'))).toBe(true);
    expect(r.requiresManualApproval).toBe(true);
  });

  it('12. Serienplanung berücksichtigt Reservierungen', () => {
    const base = profile('pg2', [
      account({ id: 'a45', catalogKey: 'paragraph_45b', allocatedCents: 13100 }),
    ]);
    const dates = ['2026-07-01', '2026-07-08', '2026-07-15'];
    const series = calculateSeriesBudgetAllocations(
      base,
      {
        assignmentDate: dates[0],
        plannedStart: '09:00',
        plannedEnd: '11:00',
        plannedMinutes: TWO_HOURS,
        hourlyRateCents: HOURLY,
        actorRoleKey: 'dispatch',
      },
      dates,
    );
    expect(series.perOccurrence.length).toBe(3);
    expect(series.perOccurrence[0].allocationProposal[0]?.amountCents).toBe(AMOUNT_6550);
    expect(series.perOccurrence[2].warnings.some((w) => w.includes('Entlastungsbetrag'))).toBe(true);
  });

  it('13. Monatswechsel erzeugt neue Termine in Expansion', () => {
    const dates = expandVisitRecurrenceDates({
      assignmentDate: '2026-07-28',
      recurrencePattern: 'weekly',
      recurrenceWeekdays: ['mo'],
      recurrenceOccurrenceCount: 2,
    });
    expect(dates.length).toBeGreaterThanOrEqual(1);
  });

  it('14. computeAssignmentAmountCents centgenau', () => {
    expect(AMOUNT_6550).toBe(6550);
    expect(AMOUNT_13100).toBe(13100);
  });

  it('15. Storno-Freigabe via releaseAssignmentBudgetReservation exportiert', async () => {
    const { releaseAssignmentBudgetReservation } = await import(
      '@/lib/assist/assignmentBudgetAllocationService'
    );
    expect(typeof releaseAssignmentBudgetReservation).toBe('function');
  });

  it('16. Finaler Verbrauch via consumeOnProofApproval exportiert', async () => {
    const { consumeOnProofApproval } = await import('@/lib/assist/clientBudgetTransactionService');
    expect(typeof consumeOnProofApproval).toBe('function');
  });

  it('17. Manuelle Überschreibung ohne Recht blockiert', () => {
    const p = profile('pg2', [account({ id: 'a45', catalogKey: 'paragraph_45b' })]);
    const r = calculateAssistBudgetAllocationFromProfile(p, {
      plannedStart: '09:00',
      plannedEnd: '11:00',
      plannedMinutes: TWO_HOURS,
      hourlyRateCents: HOURLY,
      manualOverride: { catalogKey: 'selbstzahler', amountCents: 6550, reason: 'Test' },
      actorRoleKey: 'caregiver',
    });
    expect(r.canSave).toBe(false);
    expect(r.warnings.some((w) => w.includes('Berechtigung'))).toBe(true);
  });

  it('18. Manuelle Überschreibung mit Recht verlangt Pflichtgrund', () => {
    const p = profile('pg2', [account({ id: 'a45', catalogKey: 'paragraph_45b' })]);
    const r = calculateAssistBudgetAllocationFromProfile(p, {
      plannedStart: '09:00',
      plannedEnd: '11:00',
      plannedMinutes: TWO_HOURS,
      hourlyRateCents: HOURLY,
      manualOverride: { catalogKey: 'selbstzahler', amountCents: 6550, reason: '' },
      actorRoleKey: 'billing',
    });
    expect(r.canSave).toBe(false);
    expect(r.warnings.some((w) => w.includes('Pflichtgrund'))).toBe(true);
  });

  it('19. Override mit Recht und Grund ist auditpflichtig', () => {
    const p = profile('pg2', [account({ id: 'a45', catalogKey: 'paragraph_45b' })]);
    const r = calculateAssistBudgetAllocationFromProfile(p, {
      plannedStart: '09:00',
      plannedEnd: '11:00',
      plannedMinutes: TWO_HOURS,
      hourlyRateCents: HOURLY,
      manualOverride: { catalogKey: 'paragraph_45b', amountCents: 6550, reason: 'Kassenfreigabe' },
      actorRoleKey: 'billing',
    });
    expect(r.canSave).toBe(true);
    expect(r.auditRequired).toBe(true);
    expect(hasPermission('billing', 'assist.assignment.budget.override')).toBe(true);
  });
});
