import type { ServiceResult } from '@/types';
import type {
  BudgetTemplateCatalogEntry,
  ClientBudgetAccount,
  ClientBudgetMode,
  ClientBudgetTransaction,
  ClientCareGrade,
  ClientCarePreventionBudgetMode,
} from '@/types/assist/clientAssistBilling';
import { resolveTemplateAmountCents } from '@/types/assist/clientAssistBilling';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { runService } from '@/lib/services/serviceRunner';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import {
  filterTemplatesForCareGrade,
  listBudgetTemplatesByYear,
} from './budgetTemplateCatalogService';
import {
  mapBudgetAccountRow,
  mapBudgetModeRow,
  mapTransactionRow,
  periodBoundsForDate,
} from './clientAssistBillingMappers';
import { refreshClientBillingWarningsAfterBudgetChange } from './clientBillingWarningsService';

export {
  formatBudgetPeriodLabel,
  formatBudgetPeriodLabelCapitalized,
  BUDGET_PERIOD_LABELS,
} from './budgetPeriodLabels';

async function writeBillingAuditLog(
  tenantId: string,
  clientId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  payload: Record<string, unknown>,
): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  await fromUnknownTable(client, 'client_billing_audit_log').insert({
    tenant_id: tenantId,
    client_id: clientId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    payload,
  });
}

export async function listClientBudgetAccounts(
  tenantId: string,
  clientId: string,
  budgetYear?: number,
): Promise<ServiceResult<ClientBudgetAccount[]>> {
  return getClientBudgetAccounts(tenantId, clientId, budgetYear);
}

/** Alias + enriched labels — primary read path for Budget tab. */
export async function getClientBudgetAccounts(
  tenantId: string,
  clientId: string,
  budgetYear?: number,
): Promise<ServiceResult<ClientBudgetAccount[]>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    let query = fromUnknownTable(client, 'client_budget_accounts')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .in('status', ['active', 'suspended'])
      .order('billing_priority', { ascending: true })
      .order('period_start', { ascending: false });

    if (budgetYear) query = query.eq('catalog_year', budgetYear);

    const { data, error } = await query;
    if (error) return { ok: false, error: toGermanSupabaseError(error) };

    const templates = budgetYear ? await listBudgetTemplatesByYear(budgetYear) : { ok: true as const, data: [] };
    const labelMap = new Map(
      templates.ok ? templates.data.map((t) => [t.catalogKey, t.label]) : [],
    );

    return {
      ok: true,
      data: (data ?? []).map((row) => {
        const template = templates.ok
          ? templates.data.find((t) => t.catalogKey === row.catalog_key)
          : undefined;
        return mapBudgetAccountRow(
          row as Record<string, unknown>,
          labelMap.get(row.catalog_key as string),
        );
      }).map((account) => {
        const template = templates.ok
          ? templates.data.find((t) => t.catalogKey === account.catalogKey)
          : undefined;
        return {
          ...account,
          autoGenerate: template?.autoGenerate,
          standardAmountCents:
            account.standardAmountCents ?? template?.defaultAmountCents ?? null,
        };
      }),
    };
  });
}

export type UpdateClientBudgetAccountInput = {
  individualAmountCents?: number | null;
  isIndividualOverride?: boolean;
  allocatedCents?: number;
  notes?: string | null;
  locked?: boolean;
  lockReason?: string | null;
  isEnabled?: boolean;
  status?: ClientBudgetAccount['status'];
};

export async function updateClientBudgetAccount(
  tenantId: string,
  clientId: string,
  accountId: string,
  input: UpdateClientBudgetAccountInput,
): Promise<ServiceResult<ClientBudgetAccount>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const patch: Record<string, unknown> = {};
    if (input.individualAmountCents !== undefined) {
      patch.individual_amount_cents = input.individualAmountCents;
    }
    if (input.isIndividualOverride !== undefined) {
      patch.is_individual_override = input.isIndividualOverride;
    }
    if (input.allocatedCents !== undefined) patch.allocated_cents = input.allocatedCents;
    if (input.notes !== undefined) patch.notes = input.notes;
    if (input.locked !== undefined) patch.locked = input.locked;
    if (input.lockReason !== undefined) patch.lock_reason = input.lockReason;
    if (input.isEnabled !== undefined) patch.is_enabled = input.isEnabled;
    if (input.status !== undefined) patch.status = input.status;

    if (input.isIndividualOverride && input.individualAmountCents != null) {
      patch.allocated_cents = input.individualAmountCents;
    }

    const { error } = await fromUnknownTable(client, 'client_budget_accounts')
      .update(patch)
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .eq('id', accountId);

    if (error) return { ok: false, error: toGermanSupabaseError(error) };

    await writeBillingAuditLog(tenantId, clientId, 'update_budget_account', 'client_budget_accounts', accountId, patch);
    await recalculateClientBudgetAvailability(tenantId, clientId);

    const list = await getClientBudgetAccounts(tenantId, clientId);
    if (!list.ok) return list;
    const updated = list.data.find((a) => a.id === accountId);
    if (!updated) return { ok: false, error: 'Budgetkonto nach Update nicht gefunden.' };
    return { ok: true, data: updated };
  });
}

export async function setClientBudgetEnabled(
  tenantId: string,
  clientId: string,
  accountId: string,
  enabled: boolean,
  reason?: string,
): Promise<ServiceResult<ClientBudgetAccount>> {
  return updateClientBudgetAccount(tenantId, clientId, accountId, {
    isEnabled: enabled,
    status: enabled ? 'active' : 'suspended',
    lockReason: enabled ? null : reason ?? 'Manuell deaktiviert',
    locked: !enabled,
  });
}

export async function getClientBudgetMode(
  tenantId: string,
  clientId: string,
  budgetYear: number,
): Promise<ServiceResult<ClientBudgetMode | null>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const { data, error } = await fromUnknownTable(client, 'client_budget_mode')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .eq('budget_year', budgetYear)
      .maybeSingle();

    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    if (!data) return { ok: true, data: null };
    return { ok: true, data: mapBudgetModeRow(data as Record<string, unknown>) };
  });
}

export async function setClientCarePreventionBudgetMode(
  tenantId: string,
  clientId: string,
  budgetYear: number,
  mode: ClientCarePreventionBudgetMode,
  reason: string,
): Promise<ServiceResult<ClientBudgetMode>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    if (!reason.trim()) {
      return { ok: false, error: 'Moduswechsel erfordert eine Begründung.' };
    }

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const { data, error } = await fromUnknownTable(client, 'client_budget_mode')
      .upsert(
        {
          tenant_id: tenantId,
          client_id: clientId,
          budget_year: budgetYear,
          care_prevention_mode: mode,
          mode_change_reason: reason.trim(),
        },
        { onConflict: 'tenant_id,client_id,budget_year' },
      )
      .select('*')
      .single();

    if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };

    await writeBillingAuditLog(tenantId, clientId, 'set_budget_mode', 'client_budget_mode', data.id as string, {
      carePreventionMode: mode,
      reason: reason.trim(),
    });

    if (mode === 'joint_annual_budget') {
      await fromUnknownTable(client, 'client_budget_accounts')
        .update({ is_enabled: false, status: 'suspended', lock_reason: 'Gemeinsames Jahresbudget aktiv' })
        .eq('tenant_id', tenantId)
        .eq('client_id', clientId)
        .eq('catalog_year', budgetYear)
        .in('catalog_key', ['verhinderungspflege', 'kurzzeitpflege']);
    } else {
      await fromUnknownTable(client, 'client_budget_accounts')
        .update({ is_enabled: false, status: 'suspended', lock_reason: 'Getrennte VP/Kurzzeit aktiv' })
        .eq('tenant_id', tenantId)
        .eq('client_id', clientId)
        .eq('catalog_year', budgetYear)
        .eq('catalog_key', 'gemeinsames_jahresbudget');
    }

    await recalculateClientBudgetAvailability(tenantId, clientId, budgetYear);

    return { ok: true, data: mapBudgetModeRow(data as Record<string, unknown>) };
  });
}

/** Recompute availability flags and refresh billing warnings after account changes. */
export async function recalculateClientBudgetAvailability(
  tenantId: string,
  clientId: string,
  budgetYear?: number,
): Promise<ServiceResult<ClientBudgetAccount[]>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    const year = budgetYear ?? new Date().getFullYear();
    const accountsResult = await getClientBudgetAccounts(tenantId, clientId, year);
    if (!accountsResult.ok) return accountsResult;

    await refreshClientBillingWarningsAfterBudgetChange(tenantId, clientId);
    return accountsResult;
  });
}

export async function setIndividualBudgetOverride(
  tenantId: string,
  clientId: string,
  accountId: string,
  individualAmountCents: number,
  notes?: string,
): Promise<ServiceResult<ClientBudgetAccount>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const { data: existing, error: loadError } = await fromUnknownTable(client, 'client_budget_accounts')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .eq('id', accountId)
      .maybeSingle();

    if (loadError) return { ok: false, error: toGermanSupabaseError(loadError) };
    if (!existing) return { ok: false, error: 'Budgetkonto nicht gefunden.' };

    const { error } = await fromUnknownTable(client, 'client_budget_accounts')
      .update({
        is_individual_override: true,
        individual_amount_cents: individualAmountCents,
        allocated_cents: individualAmountCents,
        notes: notes ?? existing.notes,
      })
      .eq('id', accountId);

    if (error) return { ok: false, error: toGermanSupabaseError(error) };

    await writeBillingAuditLog(tenantId, clientId, 'individual_override', 'client_budget_accounts', accountId, {
      individualAmountCents,
    });

    const list = await listClientBudgetAccounts(tenantId, clientId);
    if (!list.ok) return list;
    const updated = list.data.find((a) => a.id === accountId);
    if (!updated) return { ok: false, error: 'Budgetkonto nach Update nicht gefunden.' };
    return { ok: true, data: updated };
  });
}

async function ensureAccountForTemplate(
  tenantId: string,
  clientId: string,
  template: BudgetTemplateCatalogEntry,
  asOfDate: Date,
  existingAccounts: ClientBudgetAccount[],
): Promise<{ created: boolean; account: ClientBudgetAccount | null }> {
  const client = getSupabaseClient();
  if (!client) return { created: false, account: null };

  const { periodStart, periodEnd } = periodBoundsForDate(template.period, asOfDate);

  const existing = existingAccounts.find(
    (a) =>
      a.catalogKey === template.catalogKey
      && a.periodStart === periodStart
      && a.periodEnd === periodEnd
      && a.status === 'active',
  );
  if (existing) return { created: false, account: existing };

  if (!template.autoGenerate || template.defaultAmountCents == null) {
    return { created: false, account: null };
  }

  const allocated = resolveTemplateAmountCents(template);
  const snapshot = {
    catalogKey: template.catalogKey,
    budgetYear: template.budgetYear,
    defaultAmountCents: template.defaultAmountCents,
    label: template.label,
    frozenAt: asOfDate.toISOString(),
  };

  const { data, error } = await fromUnknownTable(client, 'client_budget_accounts')
    .insert({
      tenant_id: tenantId,
      client_id: clientId,
      catalog_template_id: template.id,
      catalog_key: template.catalogKey,
      catalog_year: template.budgetYear,
      period: template.period,
      period_start: periodStart,
      period_end: periodEnd,
      allocated_cents: allocated,
      used_cents: 0,
      reserved_cents: 0,
      is_individual_override: false,
      standard_amount_cents: template.defaultAmountCents,
      is_enabled: true,
      locked: false,
      catalog_snapshot: snapshot,
      billing_priority: template.billingPriority,
      status: 'active',
    })
    .select('*')
    .single();

  if (error || !data) return { created: false, account: null };

  await fromUnknownTable(client, 'client_budget_transactions').insert({
    tenant_id: tenantId,
    client_id: clientId,
    budget_account_id: data.id,
    transaction_type: 'allocation',
    amount_cents: allocated,
    balance_after_cents: allocated,
    note: `Automatische Konteneröffnung ${template.label}`,
  });

  await writeBillingAuditLog(tenantId, clientId, 'auto_generate_account', 'client_budget_accounts', data.id as string, snapshot);

  return {
    created: true,
    account: mapBudgetAccountRow(data as Record<string, unknown>, template.label),
  };
}

/** Auto-generate monthly/yearly accounts from catalog — never overwrites individual overrides. */
export async function ensureClientBudgetAccountsForDate(
  tenantId: string,
  clientId: string,
  careGrade: ClientCareGrade | null,
  asOfDate: Date = new Date(),
): Promise<ServiceResult<ClientBudgetAccount[]>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    const budgetYear = asOfDate.getFullYear();
    const templatesResult = await listBudgetTemplatesByYear(budgetYear);
    if (!templatesResult.ok) return templatesResult;

    const applicable = filterTemplatesForCareGrade(templatesResult.data, careGrade);
    const existingResult = await listClientBudgetAccounts(tenantId, clientId, budgetYear);
    if (!existingResult.ok) return existingResult;

    let accounts = [...existingResult.data];

    for (const template of applicable) {
      if (template.catalogKey.startsWith('umwandlung_') && careGrade === 'pg1') continue;

      const { account } = await ensureAccountForTemplate(
        tenantId,
        clientId,
        template,
        asOfDate,
        accounts,
      );
      if (account && !accounts.some((a) => a.id === account.id)) {
        accounts.push(account);
      }
    }

    return { ok: true, data: accounts };
  });
}

export async function listClientBudgetTransactions(
  tenantId: string,
  clientId: string,
  filters: {
    budgetYear?: number;
    catalogKey?: string;
    transactionType?: string;
    limit?: number;
  } = {},
): Promise<ServiceResult<ClientBudgetTransaction[]>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const accountsResult = await listClientBudgetAccounts(tenantId, clientId, filters.budgetYear);
    if (!accountsResult.ok) return accountsResult;

    let accountIds = accountsResult.data.map((a) => a.id);
    if (filters.catalogKey) {
      accountIds = accountsResult.data.filter((a) => a.catalogKey === filters.catalogKey).map((a) => a.id);
    }
    if (accountIds.length === 0) return { ok: true, data: [] };

    let query = fromUnknownTable(client, 'client_budget_transactions')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .in('budget_account_id', accountIds)
      .order('created_at', { ascending: false });

    if (filters.transactionType) query = query.eq('transaction_type', filters.transactionType);
    if (filters.limit) query = query.limit(filters.limit);

    const { data, error } = await query;
    if (error) return { ok: false, error: toGermanSupabaseError(error) };

    const accountMap = new Map(accountsResult.data.map((a) => [a.id, a]));

    return {
      ok: true,
      data: (data ?? []).map((row) => {
        const tx = mapTransactionRow(row as Record<string, unknown>);
        const account = accountMap.get(tx.budgetAccountId);
        return {
          ...tx,
          catalogKey: account?.catalogKey,
          accountLabel: account?.label ?? account?.catalogKey,
        };
      }),
    };
  });
}

export async function listClientCareEntitlements(
  tenantId: string,
  clientId: string,
  asOfDate?: string,
): Promise<ServiceResult<import('@/types/assist/clientAssistBilling').ClientCareEntitlement[]>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const { data, error } = await fromUnknownTable(client, 'client_care_entitlement')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .order('valid_from', { ascending: false });

    if (error) return { ok: false, error: toGermanSupabaseError(error) };

    const date = asOfDate ?? new Date().toISOString().slice(0, 10);
    const rows = (data ?? []).filter((row) => {
      const from = row.valid_from as string;
      const until = row.valid_until as string | null;
      return from <= date && (!until || until >= date);
    });

    const { mapCareEntitlementRow } = await import('./clientAssistBillingMappers');
    return {
      ok: true,
      data: rows.map((row) => mapCareEntitlementRow(row as Record<string, unknown>)),
    };
  });
}

export async function listClientServiceEntitlements(
  tenantId: string,
  clientId: string,
): Promise<ServiceResult<import('@/types/assist/clientAssistBilling').ClientServiceEntitlement[]>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const { data, error } = await fromUnknownTable(client, 'client_service_entitlements')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .eq('is_active', true)
      .order('valid_from', { ascending: false });

    if (error) return { ok: false, error: toGermanSupabaseError(error) };

    const { mapServiceEntitlementRow } = await import('./clientAssistBillingMappers');
    return {
      ok: true,
      data: (data ?? []).map((row) => mapServiceEntitlementRow(row as Record<string, unknown>)),
    };
  });
}
