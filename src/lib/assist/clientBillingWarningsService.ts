import type { ServiceResult } from '@/types';
import type {
  ClientBillingWarning,
  ClientBudgetAccount,
  ClientCareEntitlement,
  ClientCareGrade,
  ClientServiceEntitlement,
} from '@/types/assist/clientAssistBilling';
import { isConversionEligibleForGrade } from '@/types/assist/clientAssistBilling';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { runService } from '@/lib/services/serviceRunner';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { mapWarningRow } from './clientAssistBillingMappers';
import {
  listClientCareEntitlements,
  listClientBudgetAccounts,
  listClientServiceEntitlements,
} from './clientBudgetAccountService';

type WarningInput = {
  tenantId: string;
  clientId: string;
  careEntitlement: ClientCareEntitlement | null;
  careGrade: ClientCareGrade | null;
  budgetAccounts: ClientBudgetAccount[];
  serviceEntitlements: ClientServiceEntitlement[];
};

export function computeBillingWarnings(input: WarningInput): Omit<ClientBillingWarning, 'id' | 'createdAt' | 'resolvedAt'>[] {
  const warnings: Omit<ClientBillingWarning, 'id' | 'createdAt' | 'resolvedAt'>[] = [];
  const { tenantId, clientId, careEntitlement, careGrade, budgetAccounts, serviceEntitlements } = input;

  if (!careGrade || careGrade === 'kein') {
    warnings.push({
      tenantId,
      clientId,
      warningType: 'missing_care_grade',
      severity: 'warning',
      catalogKey: null,
      budgetAccountId: null,
      message: 'Kein Pflegegrad hinterlegt — Budgetkonten können nicht automatisch erzeugt werden.',
      isResolved: false,
    });
  }

  if (careGrade === 'pg1' && careEntitlement?.conversionEnabled) {
    warnings.push({
      tenantId,
      clientId,
      warningType: 'pg1_conversion_invalid',
      severity: 'critical',
      catalogKey: 'umwandlung_pg2',
      budgetAccountId: null,
      message: 'Pflegegrad 1: Umwandlung Entlastungsbudget ist gesetzlich nicht vorgesehen.',
      isResolved: false,
    });
  }

  if (careGrade && isConversionEligibleForGrade(careGrade) && !careEntitlement?.conversionEnabled) {
    const umwandlungKey = `umwandlung_${careGrade}`;
    const hasUmwandlung = budgetAccounts.some((a) => a.catalogKey === umwandlungKey);
    if (!hasUmwandlung) {
      warnings.push({
        tenantId,
        clientId,
        warningType: 'conversion_not_enabled',
        severity: 'info',
        catalogKey: umwandlungKey,
        budgetAccountId: null,
        message: 'Umwandlung Entlastungsbudget ist nicht aktiviert — nur § 45b monatlich verfügbar.',
        isResolved: false,
      });
    }
  }

  for (const account of budgetAccounts) {
    const remaining =
      account.remainingCents
      ?? account.allocatedCents - account.usedCents - account.reservedCents;
    if (remaining <= 0) {
      warnings.push({
        tenantId,
        clientId,
        warningType: 'budget_exhausted',
        severity: 'warning',
        catalogKey: account.catalogKey,
        budgetAccountId: account.id,
        message: `Budget „${account.label ?? account.catalogKey}“ ist aufgebraucht oder überschritten.`,
        isResolved: false,
      });
    } else if (account.reservedCents > 0 && remaining < account.allocatedCents * 0.1) {
      warnings.push({
        tenantId,
        clientId,
        warningType: 'budget_over_plan',
        severity: 'info',
        catalogKey: account.catalogKey,
        budgetAccountId: account.id,
        message: `Budget „${account.label ?? account.catalogKey}“ ist durch Reservierungen fast ausgeschöpft.`,
        isResolved: false,
      });
    }
  }

  const unclearServices = serviceEntitlements.filter((s) => s.billingMode === 'unclear');
  for (const svc of unclearServices) {
    warnings.push({
      tenantId,
      clientId,
      warningType: 'billing_unclear',
      severity: 'warning',
      catalogKey: 'ungeklaert',
      budgetAccountId: null,
      message: `Abrechnungsmodus ungeklärt für Leistung ${svc.serviceTypeKey ?? svc.id}.`,
      isResolved: false,
    });
  }

  if (budgetAccounts.length === 0 && careGrade && careGrade !== 'kein') {
    warnings.push({
      tenantId,
      clientId,
      warningType: 'no_budget_accounts',
      severity: 'info',
      catalogKey: null,
      budgetAccountId: null,
      message: 'Noch keine Budgetkonten angelegt — bitte aus Vorlage 2026 generieren.',
      isResolved: false,
    });
  }

  return warnings;
}

export async function syncClientBillingWarnings(
  tenantId: string,
  clientId: string,
  input: Omit<WarningInput, 'tenantId' | 'clientId'>,
): Promise<ServiceResult<ClientBillingWarning[]>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const computed = computeBillingWarnings({ tenantId, clientId, ...input });

    if (input.budgetAccounts.length > 0) {
      await fromUnknownTable(client, 'client_billing_warnings')
        .update({ is_resolved: true, resolved_at: new Date().toISOString() })
        .eq('tenant_id', tenantId)
        .eq('client_id', clientId)
        .eq('warning_type', 'no_budget_accounts')
        .eq('is_resolved', false);
    }

    for (const w of computed) {
      const { data: existing } = await fromUnknownTable(client, 'client_billing_warnings')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('client_id', clientId)
        .eq('warning_type', w.warningType)
        .eq('is_resolved', false)
        .maybeSingle();

      if (!existing) {
        await fromUnknownTable(client, 'client_billing_warnings').insert({
          tenant_id: tenantId,
          client_id: clientId,
          warning_type: w.warningType,
          severity: w.severity,
          catalog_key: w.catalogKey,
          budget_account_id: w.budgetAccountId,
          message: w.message,
          is_resolved: false,
        });
      }
    }

    return listClientBillingWarnings(tenantId, clientId, { unresolvedOnly: true });
  });
}

export async function listClientBillingWarnings(
  tenantId: string,
  clientId: string,
  options: { unresolvedOnly?: boolean } = {},
): Promise<ServiceResult<ClientBillingWarning[]>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    let query = fromUnknownTable(client, 'client_billing_warnings')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (options.unresolvedOnly) query = query.eq('is_resolved', false);

    const { data, error } = await query;
    if (error) return { ok: false, error: toGermanSupabaseError(error) };

    return {
      ok: true,
      data: (data ?? []).map((row) => mapWarningRow(row as Record<string, unknown>)),
    };
  });
}

/** Recompute warnings after budget reservation/consumption/storno. */
export async function refreshClientBillingWarningsAfterBudgetChange(
  tenantId: string,
  clientId: string,
): Promise<ServiceResult<ClientBillingWarning[]>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    const asOfDate = new Date().toISOString().slice(0, 10);
    const [entitlementsResult, servicesResult, accountsResult] = await Promise.all([
      listClientCareEntitlements(tenantId, clientId, asOfDate),
      listClientServiceEntitlements(tenantId, clientId),
      listClientBudgetAccounts(tenantId, clientId, new Date().getFullYear()),
    ]);

    if (!entitlementsResult.ok) return entitlementsResult;
    if (!servicesResult.ok) return servicesResult;
    if (!accountsResult.ok) return accountsResult;

    const careEntitlement = entitlementsResult.data[0] ?? null;
    const careGrade = careEntitlement?.careGrade ?? null;

    return syncClientBillingWarnings(tenantId, clientId, {
      careEntitlement,
      careGrade,
      budgetAccounts: accountsResult.data,
      serviceEntitlements: servicesResult.data,
    });
  });
}

export async function resolveClientBillingWarning(
  tenantId: string,
  clientId: string,
  warningId: string,
  actorId?: string,
): Promise<ServiceResult<void>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const { error } = await fromUnknownTable(client, 'client_billing_warnings')
      .update({
        is_resolved: true,
        resolved_at: new Date().toISOString(),
        resolved_by: actorId ?? null,
      })
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .eq('id', warningId);

    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: undefined };
  });
}
