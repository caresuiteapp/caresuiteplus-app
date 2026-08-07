import type { ServiceResult } from '@/types';
import type { ClientAssistBillingProfile, ClientCareGrade } from '@/types/assist/clientAssistBilling';
import { isConversionEligibleForGrade } from '@/types/assist/clientAssistBilling';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { runService } from '@/lib/services/serviceRunner';
import { filterTemplatesForCareGrade, listBudgetTemplatesByYear } from './budgetTemplateCatalogService';
import {
  listClientBillingPriorityRules,
  sortAccountsByPriority,
} from './clientBillingPriorityService';
import {
  listClientBillingWarnings,
  syncClientBillingWarnings,
} from './clientBillingWarningsService';
import { syncClientCareEntitlementFromLegacy } from './clientCareEntitlementSyncService';
import {
  ensureClientBudgetAccountsForDate,
  getClientBudgetMode,
  listClientBudgetAccounts,
  listClientCareEntitlements,
  listClientServiceEntitlements,
} from './clientBudgetAccountService';
import { computeCanUseBudgetByCatalogKey } from './clientBudgetTransactionService';
import { getClientFundingSelection } from '@/lib/clients/clientFundingSourceService';
import { isCatalogKeySelected } from '@/types/clients/clientFundingSource';
import { getTenantAssistHourlyRateCents } from './tenantAssistHourlyRateService';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';

type PlannedVisitBudgetRow = {
  id: string;
  assignment_date: string;
  planned_start_at: string;
  planned_end_at: string;
  duration_minutes: number | null;
  budget_amount_cents: number | null;
  billing_budget_source_key: string | null;
  planning_status: string;
  execution_status: string;
  canonical_status: string;
};

type PlannedAllocationRow = {
  assignment_id: string;
  budget_account_id: string;
  planned_amount_cents: number | null;
  reserved_amount_cents: number | null;
  allocation_status: string;
};

function isActivePlannedVisit(row: PlannedVisitBudgetRow): boolean {
  if (row.planning_status !== 'scheduled' || row.execution_status !== 'pending') return false;
  return !['cancelled', 'no_show', 'completed'].includes(row.canonical_status);
}

export function derivePlannedVisitAmountCents(
  row: Pick<
    PlannedVisitBudgetRow,
    'budget_amount_cents' | 'duration_minutes' | 'planned_start_at' | 'planned_end_at'
  >,
  hourlyRateCents: number | null,
): number {
  const stored = Number(row.budget_amount_cents ?? 0);
  if (Number.isFinite(stored) && stored > 0) return Math.round(stored);
  if (!hourlyRateCents || hourlyRateCents <= 0) return 0;

  const timestampMinutes = Math.max(
    0,
    Math.round(
      (new Date(row.planned_end_at).getTime() - new Date(row.planned_start_at).getTime()) / 60_000,
    ),
  );
  const minutes = Math.max(0, Number(row.duration_minutes ?? 0)) || timestampMinutes;
  return Math.round((minutes * hourlyRateCents) / 60);
}

export function projectPlannedReservations<T extends {
  id: string;
  allocatedCents: number;
  usedCents: number;
  reservedCents: number;
  remainingCents?: number;
}>(accounts: T[], totalsByAccountId: ReadonlyMap<string, number>): T[] {
  return accounts.map((account) => {
    const reservedCents = Math.max(0, totalsByAccountId.get(account.id) ?? 0);
    return {
      ...account,
      reservedCents,
      remainingCents: account.allocatedCents - account.usedCents - reservedCents,
    };
  });
}

async function loadPlannedReservationTotals(
  tenantId: string,
  clientId: string,
  accounts: ClientAssistBillingProfile['budgetAccounts'],
  hourlyRateCents: number | null,
): Promise<Map<string, number> | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  const { data: visitData, error: visitError } = await fromUnknownTable(client, 'assist_visits')
    .select('id, assignment_date, planned_start_at, planned_end_at, duration_minutes, budget_amount_cents, billing_budget_source_key, planning_status, execution_status, canonical_status')
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .eq('planning_status', 'scheduled')
    .eq('execution_status', 'pending');
  if (visitError) return null;

  const visits = ((visitData ?? []) as unknown as PlannedVisitBudgetRow[]).filter(isActivePlannedVisit);
  const totals = new Map<string, number>();
  if (visits.length === 0) return totals;

  const visitIds = visits.map((visit) => visit.id);
  const { data: allocationData, error: allocationError } = await fromUnknownTable(
    client,
    'assignment_budget_allocations',
  )
    .select('assignment_id, budget_account_id, planned_amount_cents, reserved_amount_cents, allocation_status')
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .in('assignment_id', visitIds)
    .in('allocation_status', ['planned', 'reserved']);

  const allocations = allocationError
    ? []
    : ((allocationData ?? []) as unknown as PlannedAllocationRow[]);
  const allocatedVisitIds = new Set<string>();
  for (const allocation of allocations) {
    const amount = Math.max(
      0,
      Number(allocation.reserved_amount_cents ?? allocation.planned_amount_cents ?? 0),
    );
    if (amount <= 0) continue;
    allocatedVisitIds.add(allocation.assignment_id);
    totals.set(
      allocation.budget_account_id,
      (totals.get(allocation.budget_account_id) ?? 0) + amount,
    );
  }

  for (const visit of visits) {
    if (allocatedVisitIds.has(visit.id)) continue;
    const amount = derivePlannedVisitAmountCents(visit, hourlyRateCents);
    if (amount <= 0) continue;

    const matchingAccount = accounts
      .filter(
        (account) =>
          account.status === 'active'
          && account.isEnabled !== false
          && !account.locked
          && account.periodStart <= visit.assignment_date
          && account.periodEnd >= visit.assignment_date
          && (!visit.billing_budget_source_key
            || account.catalogKey === visit.billing_budget_source_key),
      )
      .sort((left, right) => left.billingPriority - right.billingPriority)[0]
      ?? accounts.find(
        (account) =>
          account.catalogKey === 'paragraph_45b'
          && account.periodStart <= visit.assignment_date
          && account.periodEnd >= visit.assignment_date,
      );
    if (!matchingAccount) continue;
    totals.set(matchingAccount.id, (totals.get(matchingAccount.id) ?? 0) + amount);
  }

  return totals;
}

export type GetClientAssistBillingProfileInput = {
  tenantId: string;
  clientId: string;
  date?: string | Date;
  autoGenerateAccounts?: boolean;
};

/** Shows only the account for the requested period and removes accidental duplicate rows. */
export function selectCurrentBudgetAccounts<T extends {
  id: string;
  catalogKey: string;
  periodStart: string;
  periodEnd: string;
  usedCents: number;
  reservedCents: number;
}>(accounts: T[], asOfDate: string): T[] {
  const current = accounts.filter(
    (account) => account.periodStart <= asOfDate && account.periodEnd >= asOfDate,
  );
  const source = current.length > 0 ? current : accounts;
  const canonical = new Map<string, T>();

  for (const account of source) {
    const existing = canonical.get(account.catalogKey);
    if (!existing) {
      canonical.set(account.catalogKey, account);
      continue;
    }
    const existingActivity = existing.usedCents + existing.reservedCents;
    const nextActivity = account.usedCents + account.reservedCents;
    if (
      account.periodStart > existing.periodStart
      || (account.periodStart === existing.periodStart && nextActivity > existingActivity)
    ) {
      canonical.set(account.catalogKey, account);
    }
  }

  return [...canonical.values()];
}

function parseAsOfDate(date?: string | Date): Date {
  if (!date) return new Date();
  if (date instanceof Date) return date;
  return new Date(`${date.slice(0, 10)}T12:00:00.000Z`);
}

/** Central billing profile resolver — spec §15. */
export async function getClientAssistBillingProfile(
  input: GetClientAssistBillingProfileInput,
): Promise<ServiceResult<ClientAssistBillingProfile>> {
  return runService(async () => {
    const { tenantId, clientId, autoGenerateAccounts = true } = input;
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    const asOf = parseAsOfDate(input.date);
    const asOfDate = asOf.toISOString().slice(0, 10);
    const budgetYear = asOf.getFullYear();

    await syncClientCareEntitlementFromLegacy(tenantId, clientId, {
      regenerateAccounts: autoGenerateAccounts,
    });

    const [entitlementsResult, servicesResult, templatesResult, priorityResult, modeResult, fundingResult, catalogRateResult] = await Promise.all([
      listClientCareEntitlements(tenantId, clientId, asOfDate),
      listClientServiceEntitlements(tenantId, clientId),
      listBudgetTemplatesByYear(budgetYear),
      listClientBillingPriorityRules(tenantId, clientId),
      getClientBudgetMode(tenantId, clientId, budgetYear),
      getClientFundingSelection(tenantId, clientId),
      getTenantAssistHourlyRateCents(tenantId),
    ]);

    if (!entitlementsResult.ok) return entitlementsResult;
    if (!servicesResult.ok) return servicesResult;
    if (!templatesResult.ok) return templatesResult;
    if (!priorityResult.ok) return priorityResult;
    if (!modeResult.ok) return modeResult;
    if (!fundingResult.ok) return fundingResult;

    const fundingSources = fundingResult.data?.sources ?? [];

    const careEntitlement = entitlementsResult.data[0] ?? null;
    const careGrade: ClientCareGrade | null = careEntitlement?.careGrade ?? null;
    const conversionEligible =
      !!careEntitlement?.conversionEnabled && isConversionEligibleForGrade(careGrade);

    if (autoGenerateAccounts && careGrade) {
      await ensureClientBudgetAccountsForDate(
        tenantId,
        clientId,
        careGrade,
        asOf,
        careEntitlement?.validFrom,
        fundingSources,
      );
    }

    const accountsResult = await listClientBudgetAccounts(tenantId, clientId);
    if (!accountsResult.ok) return accountsResult;

    const selectedAccounts = accountsResult.data.filter((account) =>
      isCatalogKeySelected(account.catalogKey, fundingSources),
    );
    const plannedTotals = await loadPlannedReservationTotals(
      tenantId,
      clientId,
      selectedAccounts,
      catalogRateResult.ok ? catalogRateResult.data : null,
    );
    const projectedAccounts = plannedTotals
      ? projectPlannedReservations(selectedAccounts, plannedTotals)
      : selectedAccounts;
    const currentAccounts = selectCurrentBudgetAccounts(projectedAccounts, asOfDate);
    const sortedAccounts = sortAccountsByPriority(currentAccounts, priorityResult.data);
    const budgetVisualAccounts = projectedAccounts.filter(
      (account) => account.periodStart <= asOfDate && account.periodEnd >= asOfDate,
    );

    await syncClientBillingWarnings(tenantId, clientId, {
      careEntitlement,
      careGrade,
      budgetAccounts: sortedAccounts,
      serviceEntitlements: servicesResult.data,
    });

    const warningsResult = await listClientBillingWarnings(tenantId, clientId, { unresolvedOnly: true });
    if (!warningsResult.ok) return warningsResult;

    const applicableTemplates = filterTemplatesForCareGrade(templatesResult.data, careGrade)
      .filter((template) => isCatalogKeySelected(template.catalogKey, fundingSources));
    const canUseBudgetByCatalogKey = computeCanUseBudgetByCatalogKey(sortedAccounts, careGrade);

    const carePreventionMode =
      modeResult.data?.carePreventionMode ?? 'separate_preventive_short_term';

    return {
      ok: true,
      data: {
        asOfDate,
        budgetYear,
        careGrade,
        careEntitlement,
        conversionEligible,
        fundingSources,
        carePreventionMode,
        serviceEntitlements: servicesResult.data,
        catalogHourlyRateCents: catalogRateResult.ok ? catalogRateResult.data : null,
        budgetAccounts: sortedAccounts,
        budgetVisualAccounts,
        priorityRules: priorityResult.data,
        warnings: warningsResult.data,
        templates: applicableTemplates,
        canUseBudgetByCatalogKey,
      },
    };
  });
}
