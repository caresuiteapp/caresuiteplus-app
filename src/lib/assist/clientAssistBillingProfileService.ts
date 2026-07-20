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

    const [entitlementsResult, servicesResult, templatesResult, priorityResult, modeResult] = await Promise.all([
      listClientCareEntitlements(tenantId, clientId, asOfDate),
      listClientServiceEntitlements(tenantId, clientId),
      listBudgetTemplatesByYear(budgetYear),
      listClientBillingPriorityRules(tenantId, clientId),
      getClientBudgetMode(tenantId, clientId, budgetYear),
    ]);

    if (!entitlementsResult.ok) return entitlementsResult;
    if (!servicesResult.ok) return servicesResult;
    if (!templatesResult.ok) return templatesResult;
    if (!priorityResult.ok) return priorityResult;
    if (!modeResult.ok) return modeResult;

    const careEntitlement = entitlementsResult.data[0] ?? null;
    const careGrade: ClientCareGrade | null = careEntitlement?.careGrade ?? null;
    const conversionEligible =
      !!careEntitlement?.conversionEnabled && isConversionEligibleForGrade(careGrade);

    if (autoGenerateAccounts && careGrade) {
      await ensureClientBudgetAccountsForDate(tenantId, clientId, careGrade, asOf);
    }

    const accountsResult = await listClientBudgetAccounts(tenantId, clientId, budgetYear);
    if (!accountsResult.ok) return accountsResult;

    const currentAccounts = selectCurrentBudgetAccounts(accountsResult.data, asOfDate);
    const sortedAccounts = sortAccountsByPriority(currentAccounts, priorityResult.data);

    await syncClientBillingWarnings(tenantId, clientId, {
      careEntitlement,
      careGrade,
      budgetAccounts: sortedAccounts,
      serviceEntitlements: servicesResult.data,
    });

    const warningsResult = await listClientBillingWarnings(tenantId, clientId, { unresolvedOnly: true });
    if (!warningsResult.ok) return warningsResult;

    const applicableTemplates = filterTemplatesForCareGrade(templatesResult.data, careGrade);
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
        carePreventionMode,
        serviceEntitlements: servicesResult.data,
        budgetAccounts: sortedAccounts,
        priorityRules: priorityResult.data,
        warnings: warningsResult.data,
        templates: applicableTemplates,
        canUseBudgetByCatalogKey,
      },
    };
  });
}
