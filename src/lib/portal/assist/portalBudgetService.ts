import type { ServiceResult } from '@/types';
import type { PortalBudgetSnapshot, PortalBudgetType } from '@/types/portal/assist';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { isMissingTableError } from '@/lib/supabase/missingtablefallback';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { runService } from '@/lib/services/serviceRunner';
import { buildClientBudgetVisualModels, type ClientBudgetVisualModel } from '@/lib/assist/clientBudgetVisuals';
import {
  mapBudgetAccountRow,
  mapCareEntitlementRow,
  mapCatalogRow,
  mapServiceEntitlementRow,
} from '@/lib/assist/clientAssistBillingMappers';
import type { ClientAssistBillingProfile } from '@/types/assist/clientAssistBilling';

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
 * Portal read model for the rebuilt budget experience. It deliberately returns both cards,
 * even when conversion is not activated, so clients can see their unused potential.
 */
export async function fetchPortalBudgetVisuals(
  tenantId: string,
  clientId: string,
  asOfDate = new Date().toISOString().slice(0, 10),
): Promise<ServiceResult<ClientBudgetVisualModel[]>> {
  return runService(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const budgetYear = Number(asOfDate.slice(0, 4));

    const [entitlementResult, accountResult, serviceResult, templateResult] = await Promise.all([
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
        .lte('valid_from', asOfDate),
      fromUnknownTable(supabase, 'budget_template_catalog')
        .select('*')
        .eq('budget_year', budgetYear)
        .eq('is_active', true),
    ]);

    const firstError = entitlementResult.error ?? accountResult.error ?? serviceResult.error ?? templateResult.error;
    if (firstError) {
      if (isMissingTableError(firstError)) return { ok: true, data: [] };
      return { ok: false, error: toGermanSupabaseError(firstError) };
    }

    const careEntitlement = entitlementResult.data
      ? mapCareEntitlementRow(entitlementResult.data as Record<string, unknown>)
      : null;
    const careGrade = careEntitlement?.careGrade ?? null;
    const templates = (templateResult.data ?? []).map((row) => mapCatalogRow(row as Record<string, unknown>));
    const labelByKey = new Map(templates.map((template) => [template.catalogKey, template.label]));
    const accounts = (accountResult.data ?? []).map((row) =>
      mapBudgetAccountRow(row as Record<string, unknown>, labelByKey.get(String(row.catalog_key))),
    );
    const services = (serviceResult.data ?? []).map((row) =>
      mapServiceEntitlementRow(row as Record<string, unknown>),
    );
    const profile: ClientAssistBillingProfile = {
      asOfDate,
      budgetYear,
      careGrade,
      careEntitlement,
      conversionEligible: careEntitlement?.conversionEnabled === true,
      carePreventionMode: 'separate_preventive_short_term',
      serviceEntitlements: services,
      budgetAccounts: accounts,
      budgetVisualAccounts: accounts,
      priorityRules: [],
      warnings: [],
      templates,
      canUseBudgetByCatalogKey: {},
    };

    return { ok: true, data: buildClientBudgetVisualModels(profile) };
  });
}
