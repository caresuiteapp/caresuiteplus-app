/**
 * Klientenakte Pflegegrad & Budgets — Phase 2 mutations (entitlement, correction, recalc).
 */
import type { ServiceResult } from '@/types';
import type {
  BudgetTemplateCatalogEntry,
  ClientBudgetAccount,
  ClientCareEntitlement,
  ClientCareGrade,
} from '@/types/assist/clientAssistBilling';
import {
  isConversionEligibleForGrade,
  resolveTemplateAmountCents,
} from '@/types/assist/clientAssistBilling';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { runService } from '@/lib/services/serviceRunner';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import {
  filterTemplatesForCareGrade,
  getUmwandlungTemplateKeyForGrade,
  listBudgetTemplatesByYear,
} from './budgetTemplateCatalogService';
import { mapCareEntitlementRow } from './clientAssistBillingMappers';
import {
  ensureClientBudgetAccountsForDate,
  getClientBudgetAccounts,
  recalculateClientBudgetAvailability,
  setClientBudgetEnabled,
} from './clientBudgetAccountService';
import { computeAvailableCents } from './clientBudgetTransactionService';

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

function dayBefore(isoDate: string): string {
  const d = new Date(`${isoDate.slice(0, 10)}T12:00:00.000Z`);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export async function countOpenBudgetReservations(
  tenantId: string,
  clientId: string,
): Promise<ServiceResult<number>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const { count, error } = await fromUnknownTable(client, 'client_budget_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .eq('transaction_type', 'reservation')
      .or('lifecycle_status.is.null,lifecycle_status.in.(geplant,durchgefuehrt)');

    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: count ?? 0 };
  });
}

async function loadCurrentEntitlement(
  tenantId: string,
  clientId: string,
): Promise<ClientCareEntitlement | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  const { data } = await fromUnknownTable(client, 'client_care_entitlement')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .is('valid_until', null)
    .order('valid_from', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ? mapCareEntitlementRow(data as Record<string, unknown>) : null;
}

async function syncLegacyCareLevel(
  tenantId: string,
  clientId: string,
  careGrade: ClientCareGrade,
  validFrom: string,
  careFundName: string | null,
  careFundMemberId: string | null,
): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;

  await client
    .from('clients')
    .update({
      care_level: careGrade,
      insurance_name: careFundName,
      insurance_number: careFundMemberId,
    })
    .eq('tenant_id', tenantId)
    .eq('id', clientId);

  const { data: existingLevels } = await fromUnknownTable(client, 'client_care_levels')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .order('valid_from', { ascending: false })
    .limit(1);

  const latest = (existingLevels ?? [])[0] as { id: string } | undefined;
  const payload = {
    grade: careGrade,
    valid_from: validFrom,
    care_fund_name: careFundName ?? 'Unbekannt',
    care_fund_member_id: careFundMemberId,
  };

  if (latest) {
    await fromUnknownTable(client, 'client_care_levels')
      .update(payload)
      .eq('id', latest.id)
      .eq('tenant_id', tenantId);
  } else {
    await fromUnknownTable(client, 'client_care_levels').insert({
      tenant_id: tenantId,
      client_id: clientId,
      ...payload,
    });
  }
}

/** Change Pflegegrad — preserves historical movements; new budgets from effective date. */
export async function changeClientCareGrade(
  tenantId: string,
  clientId: string,
  input: {
    newCareGrade: ClientCareGrade;
    effectiveFrom: string;
    reason: string;
  },
): Promise<ServiceResult<ClientCareEntitlement>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    if (!input.reason.trim()) {
      return { ok: false, error: 'Pflegegrad-Änderung erfordert eine Begründung.' };
    }

    const reservations = await countOpenBudgetReservations(tenantId, clientId);
    if (!reservations.ok) return reservations;
    if (reservations.data > 0) {
      return {
        ok: false,
        error: `${reservations.data} offene Reservierung(en) — bitte zuerst klären oder stornieren.`,
      };
    }

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const current = await loadCurrentEntitlement(tenantId, clientId);
    if (current?.careGrade === input.newCareGrade && current.validFrom === input.effectiveFrom) {
      return { ok: false, error: 'Pflegegrad und Gültigkeitsdatum sind unverändert.' };
    }

    if (current) {
      await fromUnknownTable(client, 'client_care_entitlement')
        .update({ valid_until: dayBefore(input.effectiveFrom) })
        .eq('id', current.id);
    }

    const conversionEnabled =
      isConversionEligibleForGrade(input.newCareGrade)
      && (current?.conversionEnabled ?? isConversionEligibleForGrade(input.newCareGrade));

    const { data: inserted, error: insertError } = await fromUnknownTable(client, 'client_care_entitlement')
      .insert({
        tenant_id: tenantId,
        client_id: clientId,
        care_grade: input.newCareGrade,
        valid_from: input.effectiveFrom,
        valid_until: null,
        conversion_enabled: conversionEnabled,
        care_fund_name: current?.careFundName ?? null,
        care_fund_member_id: current?.careFundMemberId ?? null,
        md_assessment_date: current?.mdAssessmentDate ?? null,
        notes: input.reason.trim(),
        source: 'pflegegrad_budgets_panel',
        metadata: { previousGrade: current?.careGrade ?? null },
      })
      .select('*')
      .single();

    if (insertError || !inserted) {
      return { ok: false, error: toGermanSupabaseError(insertError) };
    }

    const entitlement = mapCareEntitlementRow(inserted as Record<string, unknown>);

    await syncLegacyCareLevel(
      tenantId,
      clientId,
      input.newCareGrade,
      input.effectiveFrom,
      entitlement.careFundName,
      entitlement.careFundMemberId,
    );

    await writeBillingAuditLog(tenantId, clientId, 'change_care_grade', 'client_care_entitlement', entitlement.id, {
      previousGrade: current?.careGrade ?? null,
      newGrade: input.newCareGrade,
      effectiveFrom: input.effectiveFrom,
      reason: input.reason.trim(),
    });

    const asOf = new Date(`${input.effectiveFrom}T12:00:00.000Z`);
    await ensureClientBudgetAccountsForDate(tenantId, clientId, input.newCareGrade, asOf);
    await recalculateClientBudgetAvailability(tenantId, clientId, asOf.getFullYear());

    return { ok: true, data: entitlement };
  });
}

export async function updateClientCareFund(
  tenantId: string,
  clientId: string,
  input: {
    careFundName: string;
    careFundMemberId: string;
    reason: string;
  },
): Promise<ServiceResult<ClientCareEntitlement>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    if (!input.careFundName.trim()) {
      return { ok: false, error: 'Pflegekasse ist Pflicht.' };
    }
    if (!input.reason.trim()) {
      return { ok: false, error: 'Änderung erfordert eine Begründung.' };
    }

    const current = await loadCurrentEntitlement(tenantId, clientId);
    if (!current) {
      return { ok: false, error: 'Kein aktiver Pflegegrad-Anspruch — zuerst Pflegegrad setzen.' };
    }

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const { data, error } = await fromUnknownTable(client, 'client_care_entitlement')
      .update({
        care_fund_name: input.careFundName.trim(),
        care_fund_member_id: input.careFundMemberId.trim() || null,
      })
      .eq('id', current.id)
      .select('*')
      .single();

    if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };

    const entitlement = mapCareEntitlementRow(data as Record<string, unknown>);

    await syncLegacyCareLevel(
      tenantId,
      clientId,
      entitlement.careGrade,
      entitlement.validFrom,
      entitlement.careFundName,
      entitlement.careFundMemberId,
    );

    await writeBillingAuditLog(tenantId, clientId, 'update_care_fund', 'client_care_entitlement', entitlement.id, {
      careFundName: input.careFundName.trim(),
      careFundMemberId: input.careFundMemberId.trim() || null,
      reason: input.reason.trim(),
    });

    return { ok: true, data: entitlement };
  });
}

export async function updateCareEntitlementValidFrom(
  tenantId: string,
  clientId: string,
  input: {
    validFrom: string;
    reason: string;
  },
): Promise<ServiceResult<ClientCareEntitlement>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    if (!input.reason.trim()) {
      return { ok: false, error: 'Datumsänderung erfordert eine Begründung.' };
    }

    const current = await loadCurrentEntitlement(tenantId, clientId);
    if (!current) {
      return { ok: false, error: 'Kein aktiver Pflegegrad-Anspruch.' };
    }
    if (current.validFrom === input.validFrom) {
      return { ok: false, error: 'Gültig-ab-Datum ist unverändert.' };
    }

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const { data, error } = await fromUnknownTable(client, 'client_care_entitlement')
      .update({ valid_from: input.validFrom })
      .eq('id', current.id)
      .select('*')
      .single();

    if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };

    const entitlement = mapCareEntitlementRow(data as Record<string, unknown>);

    await syncLegacyCareLevel(
      tenantId,
      clientId,
      entitlement.careGrade,
      entitlement.validFrom,
      entitlement.careFundName,
      entitlement.careFundMemberId,
    );

    await writeBillingAuditLog(tenantId, clientId, 'update_valid_from', 'client_care_entitlement', entitlement.id, {
      previousValidFrom: current.validFrom,
      validFrom: input.validFrom,
      reason: input.reason.trim(),
    });

    await ensureClientBudgetAccountsForDate(
      tenantId,
      clientId,
      entitlement.careGrade,
      new Date(`${input.validFrom}T12:00:00.000Z`),
    );

    return { ok: true, data: entitlement };
  });
}

/** Toggle §45a Umwandlung — historical movements preserved; blocks or enables new usage. */
export async function setClientConversionEnabled(
  tenantId: string,
  clientId: string,
  enabled: boolean,
  reason: string,
): Promise<ServiceResult<ClientCareEntitlement>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    if (!reason.trim()) {
      return { ok: false, error: 'Umwandlung-Änderung erfordert eine Begründung.' };
    }

    const current = await loadCurrentEntitlement(tenantId, clientId);
    if (!current) {
      return { ok: false, error: 'Kein aktiver Pflegegrad-Anspruch.' };
    }
    if (!isConversionEligibleForGrade(current.careGrade)) {
      return { ok: false, error: 'Pflegegrad 1: Umwandlung ist gesetzlich nicht vorgesehen.' };
    }
    if (current.conversionEnabled === enabled) {
      return { ok: false, error: enabled ? 'Umwandlung ist bereits aktiv.' : 'Umwandlung ist bereits deaktiviert.' };
    }

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const { data, error } = await fromUnknownTable(client, 'client_care_entitlement')
      .update({ conversion_enabled: enabled })
      .eq('id', current.id)
      .select('*')
      .single();

    if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };

    const entitlement = mapCareEntitlementRow(data as Record<string, unknown>);

    const umwandlungKey = getUmwandlungTemplateKeyForGrade(entitlement.careGrade);
    const accountsResult = await getClientBudgetAccounts(tenantId, clientId);
    if (accountsResult.ok && umwandlungKey) {
      for (const account of accountsResult.data.filter((a) => a.catalogKey.startsWith('umwandlung_'))) {
        if (enabled && account.catalogKey === umwandlungKey) {
          await setClientBudgetEnabled(tenantId, clientId, account.id, true, 'Umwandlung aktiviert');
        } else if (!enabled) {
          await setClientBudgetEnabled(
            tenantId,
            clientId,
            account.id,
            false,
            'Umwandlung deaktiviert — historische Bewegungen bleiben erhalten',
          );
        }
      }
    }

    if (enabled) {
      await ensureClientBudgetAccountsForDate(tenantId, clientId, entitlement.careGrade);
    }

    await writeBillingAuditLog(tenantId, clientId, 'set_conversion_enabled', 'client_care_entitlement', entitlement.id, {
      enabled,
      reason: reason.trim(),
    });

    await recalculateClientBudgetAvailability(tenantId, clientId);
    return { ok: true, data: entitlement };
  });
}

export type BudgetCorrectionInput = {
  budgetAccountId: string;
  amountCents: number;
  reason: string;
  effectiveDate: string;
};

/** Book manual budget correction (+/-) — creates adjustment transaction. */
export async function bookBudgetCorrection(
  tenantId: string,
  clientId: string,
  input: BudgetCorrectionInput,
): Promise<ServiceResult<{ transactionId: string }>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    if (!input.reason.trim()) {
      return { ok: false, error: 'Korrektur erfordert eine Begründung.' };
    }
    if (input.amountCents === 0) {
      return { ok: false, error: 'Korrekturbetrag darf nicht 0 sein.' };
    }

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const { data: accountRow, error: loadError } = await fromUnknownTable(client, 'client_budget_accounts')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .eq('id', input.budgetAccountId)
      .maybeSingle();

    if (loadError) return { ok: false, error: toGermanSupabaseError(loadError) };
    if (!accountRow) return { ok: false, error: 'Budgetkonto nicht gefunden.' };

    const allocated = Number(accountRow.allocated_cents);
    const used = Number(accountRow.used_cents);
    const reserved = Number(accountRow.reserved_cents);
    const newAllocated = allocated + input.amountCents;

    if (newAllocated < used + reserved) {
      return {
        ok: false,
        error: 'Korrektur würde verfügbares Budget unter Reservierungen/Verbrauch senken.',
      };
    }

    const balanceAfter = newAllocated - used - reserved;

    const { data: txRow, error: txError } = await fromUnknownTable(client, 'client_budget_transactions')
      .insert({
        tenant_id: tenantId,
        client_id: clientId,
        budget_account_id: input.budgetAccountId,
        transaction_type: 'adjustment',
        amount_cents: Math.abs(input.amountCents),
        balance_after_cents: balanceAfter,
        reference_type: 'manual_correction',
        reference_id: null,
        note: `[${input.effectiveDate}] ${input.reason.trim()}`,
      })
      .select('*')
      .single();

    if (txError || !txRow) return { ok: false, error: toGermanSupabaseError(txError) };

    const { error: updateError } = await fromUnknownTable(client, 'client_budget_accounts')
      .update({ allocated_cents: newAllocated })
      .eq('id', input.budgetAccountId);

    if (updateError) return { ok: false, error: toGermanSupabaseError(updateError) };

    await writeBillingAuditLog(
      tenantId,
      clientId,
      'book_budget_correction',
      'client_budget_transactions',
      txRow.id as string,
      {
        budgetAccountId: input.budgetAccountId,
        amountCents: input.amountCents,
        effectiveDate: input.effectiveDate,
        reason: input.reason.trim(),
      },
    );

    await recalculateClientBudgetAvailability(tenantId, clientId);
    return { ok: true, data: { transactionId: txRow.id as string } };
  });
}

export type BudgetRecalcDiff = {
  accountId: string;
  catalogKey: string;
  label: string;
  currentAllocatedCents: number;
  catalogAmountCents: number;
  deltaCents: number;
  skipped: boolean;
  skipReason?: string;
};

export function computeBudgetRecalculationDiffs(
  profile: {
    careGrade: ClientCareGrade | null;
    conversionEligible: boolean;
    careEntitlement: ClientCareEntitlement | null;
    budgetAccounts: ClientBudgetAccount[];
    templates: BudgetTemplateCatalogEntry[];
  },
): BudgetRecalcDiff[] {
  const applicableKeys = new Set(
    filterTemplatesForCareGrade(profile.templates, profile.careGrade).map((t) => t.catalogKey),
  );

  if (!profile.conversionEligible || !profile.careEntitlement?.conversionEnabled) {
    for (const key of [...applicableKeys]) {
      if (key.startsWith('umwandlung_')) applicableKeys.delete(key);
    }
  }

  const templateByKey = new Map(profile.templates.map((t) => [t.catalogKey, t]));
  const diffs: BudgetRecalcDiff[] = [];

  for (const account of profile.budgetAccounts.filter((a) => a.status === 'active')) {
    if (!applicableKeys.has(account.catalogKey)) continue;

    const template = templateByKey.get(account.catalogKey);
    if (!template) continue;

    if (account.isIndividualOverride) {
      diffs.push({
        accountId: account.id,
        catalogKey: account.catalogKey,
        label: account.label ?? account.catalogKey,
        currentAllocatedCents: account.allocatedCents,
        catalogAmountCents: account.individualAmountCents ?? account.allocatedCents,
        deltaCents: 0,
        skipped: true,
        skipReason: 'Individuelles Budget — nicht überschreiben',
      });
      continue;
    }

    const catalogAmount = resolveTemplateAmountCents(template);
    const delta = catalogAmount - account.allocatedCents;

    diffs.push({
      accountId: account.id,
      catalogKey: account.catalogKey,
      label: account.label ?? template.label,
      currentAllocatedCents: account.allocatedCents,
      catalogAmountCents: catalogAmount,
      deltaCents: delta,
      skipped: delta === 0,
      skipReason: delta === 0 ? 'Keine Abweichung' : undefined,
    });
  }

  return diffs;
}

/** Apply catalog-based recalculation for non-individual accounts after user confirmation. */
export async function applyBudgetRecalculation(
  tenantId: string,
  clientId: string,
  diffs: BudgetRecalcDiff[],
  reason: string,
): Promise<ServiceResult<{ updated: number }>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    if (!reason.trim()) {
      return { ok: false, error: 'Neuberechnung erfordert eine Begründung.' };
    }

    const toApply = diffs.filter((d) => !d.skipped && d.deltaCents !== 0);
    if (toApply.length === 0) {
      return { ok: false, error: 'Keine anwendbaren Abweichungen.' };
    }

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    let updated = 0;

    for (const diff of toApply) {
      const { data: accountRow } = await fromUnknownTable(client, 'client_budget_accounts')
        .select('*')
        .eq('id', diff.accountId)
        .maybeSingle();

      if (!accountRow) continue;

      const used = Number(accountRow.used_cents);
      const reserved = Number(accountRow.reserved_cents);
      const newAllocated = diff.catalogAmountCents;

      if (newAllocated < used + reserved) {
        return {
          ok: false,
          error: `Konto „${diff.label}“: Katalogbetrag würde unter Verbrauch/Reservierung liegen.`,
        };
      }

      await fromUnknownTable(client, 'client_budget_accounts')
        .update({
          allocated_cents: newAllocated,
          standard_amount_cents: diff.catalogAmountCents,
        })
        .eq('id', diff.accountId);

      const balanceAfter = computeAvailableCents({
        allocatedCents: newAllocated,
        usedCents: used,
        reservedCents: reserved,
      });

      await fromUnknownTable(client, 'client_budget_transactions').insert({
        tenant_id: tenantId,
        client_id: clientId,
        budget_account_id: diff.accountId,
        transaction_type: 'adjustment',
        amount_cents: Math.abs(diff.deltaCents),
        balance_after_cents: balanceAfter,
        reference_type: 'catalog_recalc',
        note: `[Neuberechnung] ${reason.trim()} (${diff.currentAllocatedCents} → ${newAllocated})`,
      });

      updated += 1;
    }

    await writeBillingAuditLog(tenantId, clientId, 'recalculate_budget_accounts', 'client_budget_accounts', null, {
      reason: reason.trim(),
      updatedAccounts: toApply.map((d) => ({ accountId: d.accountId, deltaCents: d.deltaCents })),
    });

    await recalculateClientBudgetAvailability(tenantId, clientId);
    return { ok: true, data: { updated } };
  });
}

/** Deactivate budget account with mandatory reason and audit. */
export async function deactivateClientBudgetAccount(
  tenantId: string,
  clientId: string,
  accountId: string,
  reason: string,
): Promise<ServiceResult<ClientBudgetAccount>> {
  if (!reason.trim()) {
    return { ok: false, error: 'Deaktivierung erfordert eine Begründung.' };
  }

  const result = await setClientBudgetEnabled(tenantId, clientId, accountId, false, reason.trim());
  if (!result.ok) return result;

  await writeBillingAuditLog(tenantId, clientId, 'deactivate_budget_account', 'client_budget_accounts', accountId, {
    reason: reason.trim(),
  });

  return result;
}

export async function previewBudgetRecalculationFromCatalog(
  tenantId: string,
  clientId: string,
  budgetYear: number,
  careGrade: ClientCareGrade | null,
  conversionEligible: boolean,
  careEntitlement: ClientCareEntitlement | null,
): Promise<ServiceResult<BudgetRecalcDiff[]>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    const [templatesResult, accountsResult] = await Promise.all([
      listBudgetTemplatesByYear(budgetYear),
      getClientBudgetAccounts(tenantId, clientId, budgetYear),
    ]);

    if (!templatesResult.ok) return templatesResult;
    if (!accountsResult.ok) return accountsResult;

    const diffs = computeBudgetRecalculationDiffs({
      careGrade,
      conversionEligible,
      careEntitlement,
      budgetAccounts: accountsResult.data,
      templates: filterTemplatesForCareGrade(templatesResult.data, careGrade),
    });

    return { ok: true, data: diffs };
  });
}
