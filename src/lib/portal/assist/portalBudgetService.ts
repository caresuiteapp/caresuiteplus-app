import type { ServiceResult } from '@/types';
import type { PortalBudgetSnapshot, PortalBudgetType } from '@/types/portal/assist';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { isMissingTableError } from '@/lib/supabase/missingtablefallback';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { runService } from '@/lib/services/serviceRunner';
import { buildClientBudgetVisualModels, calculateRemainingCareAllowanceCents, conversionCatalogKeyForGrade, type ClientBudgetVisualModel } from '@/lib/assist/clientBudgetVisuals';
import {
  mapBudgetAccountRow,
  mapCareEntitlementRow,
  mapCatalogRow,
  mapServiceEntitlementRow,
} from '@/lib/assist/clientAssistBillingMappers';
import type { ClientAssistBillingProfile } from '@/types/assist/clientAssistBilling';
import { canClientPortalSeeFeature, fetchClientPortalSettingsResolved } from '@/lib/client/clientPortalSettingsService';
import { getClientFundingSelection } from '@/lib/clients/clientFundingSourceService';
import { isCatalogKeySelected } from '@/types/clients/clientFundingSource';
import { getTenantAssistHourlyRateCents } from '@/lib/assist/tenantAssistHourlyRateService';

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

function mapBudgetRow(row: Record<string, unknown>): PortalBudgetSnapshot {
  return {
    id: String(row.id ?? ''),
    tenantId: String(row.tenant_id ?? ''),
    clientId: String(row.client_id ?? ''),
    budgetType: String(row.budget_type ?? 'paragraph_45b') as PortalBudgetType,
    periodStart: String(row.period_start ?? ''),
    periodEnd: String(row.period_end ?? ''),
    totalAmount: Number(row.total_amount ?? 0),
    usedAmount: Number(row.used_amount ?? 0),
    remainingAmount: Number(row.remaining_amount ?? 0),
    currency: String(row.currency ?? 'EUR'),
  };
}

/** Read latest budget snapshot for client — prefers §45b, then §45a. */
export async function fetchPortalBudgetSnapshot(
  tenantId: string,
  clientId: string,
  budgetTypes: PortalBudgetType[] = ['paragraph_45b'],
): Promise<ServiceResult<PortalBudgetSnapshot | null>> {
  return runService(async () => {
    const settings = await fetchClientPortalSettingsResolved(tenantId, clientId);
    if (!settings.ok) return settings;
    if (!canClientPortalSeeFeature(settings.data, 'budget')) return { ok: true, data: null };
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    for (const budgetType of budgetTypes) {
      const { data, error } = await fromUnknownTable(supabase, 'portal_budget_snapshots')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('client_id', clientId)
        .eq('budget_type', budgetType)
        .order('period_end', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        if (isMissingTableError(error)) return { ok: true, data: null };
        return { ok: false, error: toGermanSupabaseError(error) };
      }

      if (data) {
        return { ok: true, data: mapBudgetRow(data as Record<string, unknown>) };
      }
    }

    return { ok: true, data: null };
  });
}

/**
 * Portal live balances use only released personal accounts and the current
 * funding selection. Statutory potential is never substituted for a balance.
 */
export async function fetchPortalBudgetVisuals(
  tenantId: string,
  clientId: string,
  asOfDate = new Date().toISOString().slice(0, 10),
): Promise<ServiceResult<ClientBudgetVisualModel[]>> {
  return runService(async () => {
    if (!tenantId.trim() || !clientId.trim()) return { ok: true, data: [] };
    const settings = await fetchClientPortalSettingsResolved(tenantId, clientId);
    if (!settings.ok) return settings;
    if (!canClientPortalSeeFeature(settings.data, 'budget')) return { ok: true, data: [] };
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const budgetYear = Number(asOfDate.slice(0, 4));

    const [entitlementResult, accountResult, serviceResult, templateResult, fundingResult, rateResult] = await Promise.all([
      fromUnknownTable(supabase, 'client_care_entitlement')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('client_id', clientId)
        .lte('valid_from', asOfDate)
        .or(`valid_until.is.null,valid_until.gte.${asOfDate}`)
        .order('valid_from', { ascending: false })
        .limit(1)
        .maybeSingle(),
      fromUnknownTable(supabase, 'client_budget_accounts')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('client_id', clientId)
        .in('status', ['active', 'suspended'])
        .lte('period_start', asOfDate)
        .gte('period_end', asOfDate),
      fromUnknownTable(supabase, 'client_service_entitlements')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('client_id', clientId)
        .eq('is_active', true)
        .lte('valid_from', asOfDate)
        .or(`valid_until.is.null,valid_until.gte.${asOfDate}`),
      fromUnknownTable(supabase, 'budget_template_catalog')
        .select('*')
        .eq('budget_year', budgetYear)
        .eq('is_active', true),
      getClientFundingSelection(tenantId, clientId),
      getTenantAssistHourlyRateCents(tenantId),
    ]);

    const firstError = entitlementResult.error ?? accountResult.error ?? serviceResult.error ?? templateResult.error;
    if (firstError) {
      if (isMissingTableError(firstError)) return { ok: true, data: [] };
      return { ok: false, error: toGermanSupabaseError(firstError) };
    }
    if (!fundingResult.ok) return fundingResult;
    // Statutory templates describe potential. Without a personal account they
    // must never be presented as a client's available or booked live budget.
    if ((accountResult.data ?? []).length === 0) return { ok: true, data: [] };
    const fundingSources = fundingResult.data?.sources ?? [];

    const careEntitlement = entitlementResult.data
      ? mapCareEntitlementRow(entitlementResult.data as Record<string, unknown>)
      : null;
    const careGrade = careEntitlement?.careGrade ?? null;
    const templates = (templateResult.data ?? []).map((row) => mapCatalogRow(row as Record<string, unknown>));
    const labelByKey = new Map(templates.map((template) => [template.catalogKey, template.label]));
    const accounts = (accountResult.data ?? []).map((row) =>
      mapBudgetAccountRow(row as Record<string, unknown>, labelByKey.get(String(row.catalog_key))),
    ).filter((account) => isCatalogKeySelected(account.catalogKey, fundingSources));
    if (accounts.length === 0) return { ok: true, data: [] };
    const services = (serviceResult.data ?? []).map((row) =>
      mapServiceEntitlementRow(row as Record<string, unknown>),
    );
    const profile: ClientAssistBillingProfile = {
      asOfDate,
      budgetYear,
      careGrade,
      careEntitlement,
      conversionEligible: careEntitlement?.conversionEnabled === true,
      fundingSources,
      carePreventionMode: 'separate_preventive_short_term',
      serviceEntitlements: services,
      catalogHourlyRateCents: rateResult.ok ? rateResult.data : null,
      budgetAccounts: accounts,
      budgetVisualAccounts: accounts,
      priorityRules: [],
      warnings: [],
      templates,
      canUseBudgetByCatalogKey: {},
    };

    const accountKeys = new Set(accounts.map((account) => account.catalogKey));
    const visuals = buildClientBudgetVisualModels(profile).flatMap((model) => {
      const key = model.id === 'entlastung' ? 'paragraph_45b' : conversionCatalogKeyForGrade(careGrade);
      if (key == null || !accountKeys.has(key)) return [];
      const matching = accounts.filter((account) => account.catalogKey === key)
        .sort((a, b) => b.periodStart.localeCompare(a.periodStart));
      const personalAccounts = model.id === 'entlastung' ? matching : matching.slice(0, 1);
      const totalCents = personalAccounts.reduce((sum, account) => sum + Math.max(0,
        account.isIndividualOverride && account.individualAmountCents != null
          ? account.individualAmountCents : account.allocatedCents), 0);
      const usedCents = Math.min(totalCents, Math.max(0, personalAccounts.reduce((sum, account) => sum + account.usedCents, 0)));
      const reservedCents = Math.min(totalCents - usedCents, Math.max(0, personalAccounts.reduce((sum, account) => sum + account.reservedCents, 0)));
      const availableCents = totalCents - usedCents - reservedCents;
      const percent = (cents: number) => totalCents > 0 ? Math.round(cents / totalCents * 100) : 0;
      // The shared office model also supports statutory potential. In a portal
      // live balance, an actual zero allocation must remain exactly zero.
      return [{ ...model, totalCents, usedCents, reservedCents, availableCents,
        usedPercent: percent(usedCents), reservedPercent: percent(reservedCents), availablePercent: percent(availableCents),
        availableHours: model.hourlyRateCents && model.hourlyRateCents > 0
          ? Math.round(availableCents / model.hourlyRateCents * 100) / 100 : null,
        remainingCareAllowanceCents: model.id === 'umwandlung'
          ? calculateRemainingCareAllowanceCents({ careGrade, conversionUsedCents: usedCents,
              externalSachleistungCents: model.externalSachleistungCents }) : null,
      }];
    });
    return { ok: true, data: visuals };
  });
}
