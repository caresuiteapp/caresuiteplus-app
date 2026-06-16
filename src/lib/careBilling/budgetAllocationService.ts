import type {
  BudgetAllocationResult,
  BudgetStatus,
  CareBillingGrade,
  CareBudgetType,
  ClientBudgetPeriod,
  TenantBudgetConfig,
} from '@/types/careBilling';
import {
  BUDGET_ALLOCATION_PRIORITY,
  DEFAULT_ENTLASTUNGSBETRAG_MONTHLY_CENTS,
} from '@/types/careBilling';
import { readBudgetConfig } from './careBillingStore';

const UMWANDLUNG_ELIGIBLE_GRADES: CareBillingGrade[] = ['pg2', 'pg3', 'pg4', 'pg5'];

const ACTIVE_BUDGET_STATUSES: BudgetStatus[] = ['aktiv', 'genehmigt'];

export function getEntlastungsbetragMonthlyCents(tenantId: string): number {
  const config = readBudgetConfig(tenantId);
  return config?.entlastungsbetragMonthlyCents ?? DEFAULT_ENTLASTUNGSBETRAG_MONTHLY_CENTS;
}

export function isUmwandlungEnabled(tenantId: string): boolean {
  const config = readBudgetConfig(tenantId);
  return config?.umwandlungEnabled === true;
}

export function getAvailableBudgetCents(period: ClientBudgetPeriod): number {
  return Math.max(
    0,
    period.totalAmountCents - period.usedAmountCents - period.reservedAmountCents,
  );
}

export function isBudgetUsable(period: ClientBudgetPeriod, careGrade: CareBillingGrade | null): boolean {
  if (period.status === 'ausgeschoepft' || period.status === 'abgelehnt') {
    return false;
  }
  if (period.budgetType === 'umwandlungsanspruch') {
    if (!careGrade || !UMWANDLUNG_ELIGIBLE_GRADES.includes(careGrade)) {
      return false;
    }
    return ACTIVE_BUDGET_STATUSES.includes(period.status);
  }
  if (period.budgetType === 'paragraph_45b') {
    return ACTIVE_BUDGET_STATUSES.includes(period.status) || period.status === 'nicht_genutzt';
  }
  if (period.budgetType === 'jahres_sonderbudget') {
    return ACTIVE_BUDGET_STATUSES.includes(period.status);
  }
  return period.budgetType === 'selbstzahler';
}

export function sortBudgetsByPriority(periods: ClientBudgetPeriod[]): ClientBudgetPeriod[] {
  return [...periods].sort((a, b) => {
    const pa = BUDGET_ALLOCATION_PRIORITY.indexOf(a.budgetType);
    const pb = BUDGET_ALLOCATION_PRIORITY.indexOf(b.budgetType);
    return pa - pb;
  });
}

export function allocateBudgetForAmount(
  tenantId: string,
  periods: ClientBudgetPeriod[],
  amountCents: number,
  careGrade: CareBillingGrade | null,
): BudgetAllocationResult {
  const warnings: string[] = [];
  const allocations: BudgetAllocationResult['allocations'] = [];
  let remaining = amountCents;

  if (amountCents <= 0) {
    return {
      totalAmountCents: 0,
      allocations: [],
      selfPayerAmountCents: 0,
      warnings: [],
      blocked: true,
      blockedReason: 'Betrag muss größer als 0 sein.',
    };
  }

  const sorted = sortBudgetsByPriority(periods);

  for (const period of sorted) {
    if (remaining <= 0) break;
    if (period.budgetType === 'selbstzahler') continue;

    if (period.budgetType === 'umwandlungsanspruch' && !isUmwandlungEnabled(tenantId)) {
      warnings.push('Umwandlungsanspruch ist mandantenseitig nicht aktiviert.');
      continue;
    }

    if (!isBudgetUsable(period, careGrade)) {
      if (period.budgetType === 'umwandlungsanspruch') {
        warnings.push('Umwandlungsanspruch nicht aktiv/genehmigt oder Pflegegrad ungeeignet.');
      }
      continue;
    }

    const available = getAvailableBudgetCents(period);
    if (available <= 0) continue;

    const allocated = Math.min(remaining, available);
    allocations.push({
      budgetType: period.budgetType,
      budgetPeriodId: period.id,
      amountCents: allocated,
    });
    remaining -= allocated;
  }

  const selfPayerAmountCents = remaining;

  if (selfPayerAmountCents > 0) {
    warnings.push(
      `Restbetrag ${(selfPayerAmountCents / 100).toFixed(2)} EUR als Selbstzahleranteil.`,
    );
  }

  return {
    totalAmountCents: amountCents,
    allocations,
    selfPayerAmountCents,
    warnings,
    blocked: false,
    blockedReason: null,
  };
}

export function createDefaultBudgetConfig(tenantId: string): TenantBudgetConfig {
  return {
    tenantId,
    entlastungsbetragMonthlyCents: DEFAULT_ENTLASTUNGSBETRAG_MONTHLY_CENTS,
    umwandlungEnabled: false,
    updatedAt: new Date().toISOString(),
  };
}

export function parseCareGrade(grade: string | null | undefined): CareBillingGrade | null {
  if (!grade) return null;
  const normalized = grade.toLowerCase().replace(/\s+/g, '');
  const map: Record<string, CareBillingGrade> = {
    pg1: 'pg1',
    pg2: 'pg2',
    pg3: 'pg3',
    pg4: 'pg4',
    pg5: 'pg5',
    pflegegrad1: 'pg1',
    pflegegrad2: 'pg2',
    pflegegrad3: 'pg3',
    pflegegrad4: 'pg4',
    pflegegrad5: 'pg5',
  };
  return map[normalized] ?? null;
}
