/**
 * Budget transactions on client_budget_accounts — Einsatz/Nachweis lifecycle (Migration 0175/0177).
 */
import type { ServiceResult } from '@/types';
import type {
  ClientBudgetAccount,
  ClientBudgetTransaction,
  ClientBudgetTransactionType,
} from '@/types/assist/clientAssistBilling';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isSupabaseMissingTableError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { runService } from '@/lib/services/serviceRunner';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { mapBudgetAccountRow, mapTransactionRow } from './clientAssistBillingMappers';
import {
  listClientBillingPriorityRules,
  sortAccountsByPriority,
} from './clientBillingPriorityService';
import { listClientBudgetAccounts } from './clientBudgetAccountService';
import { refreshClientBillingWarningsAfterBudgetChange } from './clientBillingWarningsService';

export type BudgetLifecycleStatus =
  | 'geplant'
  | 'durchgefuehrt'
  | 'nachgewiesen'
  | 'freigegeben'
  | 'abgerechnet'
  | 'storniert';

type TransactionRow = Record<string, unknown>;

export function computeAvailableCents(account: Pick<ClientBudgetAccount, 'allocatedCents' | 'usedCents' | 'reservedCents'>): number {
  return account.allocatedCents - account.usedCents - account.reservedCents;
}

/** Pick budget account by priority / optional catalog key hint from assignment wizard. */
export function selectAccountForReservation(
  accounts: ClientBudgetAccount[],
  amountCents: number,
  catalogKeyHint?: string | null,
): ClientBudgetAccount | null {
  if (catalogKeyHint) {
    const hinted = accounts.find(
      (a) => a.catalogKey === catalogKeyHint && computeAvailableCents(a) >= amountCents,
    );
    if (hinted) return hinted;
  }
  return accounts.find((a) => computeAvailableCents(a) >= amountCents) ?? null;
}

async function writeBillingAuditLog(
  tenantId: string,
  clientId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  payload: Record<string, unknown>,
  actorId?: string | null,
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
    actor_id: actorId ?? null,
  });
}

async function loadAccountById(
  tenantId: string,
  accountId: string,
): Promise<ClientBudgetAccount | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  const { data } = await fromUnknownTable(client, 'client_budget_accounts')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', accountId)
    .maybeSingle();

  return data ? mapBudgetAccountRow(data as Record<string, unknown>) : null;
}

async function patchAccountBalances(
  tenantId: string,
  accountId: string,
  deltas: { usedDelta?: number; reservedDelta?: number },
): Promise<ServiceResult<ClientBudgetAccount>> {
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const account = await loadAccountById(tenantId, accountId);
  if (!account) return { ok: false, error: 'Budgetkonto nicht gefunden.' };

  const used = account.usedCents + (deltas.usedDelta ?? 0);
  const reserved = Math.max(0, account.reservedCents + (deltas.reservedDelta ?? 0));

  const { error } = await fromUnknownTable(client, 'client_budget_accounts')
    .update({ used_cents: used, reserved_cents: reserved })
    .eq('tenant_id', tenantId)
    .eq('id', accountId);

  if (error) return { ok: false, error: toGermanSupabaseError(error) };

  const refreshed = await loadAccountById(tenantId, accountId);
  if (!refreshed) return { ok: false, error: 'Budgetkonto nach Update nicht gefunden.' };
  return { ok: true, data: refreshed };
}

async function findActiveVisitReservationForAccount(
  tenantId: string,
  visitId: string,
  budgetAccountId: string,
): Promise<TransactionRow | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  const { data } = await fromUnknownTable(client, 'client_budget_transactions')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('reference_type', 'assist_visit')
    .eq('reference_id', visitId)
    .eq('budget_account_id', budgetAccountId)
    .eq('transaction_type', 'reservation')
    .or('lifecycle_status.is.null,lifecycle_status.in.(geplant,durchgefuehrt)')
    .maybeSingle();

  return (data as TransactionRow | null) ?? null;
}

async function findActiveVisitReservations(
  tenantId: string,
  visitId: string,
): Promise<TransactionRow[]> {
  const client = getSupabaseClient();
  if (!client) return [];

  const { data } = await fromUnknownTable(client, 'client_budget_transactions')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('reference_type', 'assist_visit')
    .eq('reference_id', visitId)
    .eq('transaction_type', 'reservation')
    .or('lifecycle_status.is.null,lifecycle_status.in.(geplant,durchgefuehrt)');

  return (data as TransactionRow[] | null) ?? [];
}

async function insertTransaction(input: {
  tenantId: string;
  clientId: string;
  budgetAccountId: string;
  transactionType: ClientBudgetTransactionType;
  amountCents: number;
  balanceAfterCents: number | null;
  referenceType: string | null;
  referenceId: string | null;
  lifecycleStatus: BudgetLifecycleStatus | null;
  note: string;
  createdBy?: string | null;
  invoiceId?: string | null;
}): Promise<ServiceResult<ClientBudgetTransaction>> {
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const { data, error } = await fromUnknownTable(client, 'client_budget_transactions')
    .insert({
      tenant_id: input.tenantId,
      client_id: input.clientId,
      budget_account_id: input.budgetAccountId,
      transaction_type: input.transactionType,
      amount_cents: input.amountCents,
      balance_after_cents: input.balanceAfterCents,
      reference_type: input.referenceType,
      reference_id: input.referenceId,
      lifecycle_status: input.lifecycleStatus,
      note: input.note,
      created_by: input.createdBy ?? null,
      invoice_id: input.invoiceId ?? null,
    })
    .select('*')
    .single();

  if (error) {
    if (isSupabaseMissingTableError(error)) {
      return { ok: false, error: 'Budget-Transaktionen fehlen — Migration 0175/0177 anwenden.' };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return { ok: true, data: mapTransactionRow(data as Record<string, unknown>) };
}

async function resolveAccountForAmount(
  tenantId: string,
  clientId: string,
  amountCents: number,
  catalogKeyHint?: string | null,
  asOfDate?: Date,
): Promise<ServiceResult<ClientBudgetAccount>> {
  const year = (asOfDate ?? new Date()).getFullYear();
  const accountsResult = await listClientBudgetAccounts(tenantId, clientId, year);
  if (!accountsResult.ok) return accountsResult;

  const rulesResult = await listClientBillingPriorityRules(tenantId, clientId);
  if (!rulesResult.ok) return rulesResult;

  const sorted = sortAccountsByPriority(accountsResult.data, rulesResult.data);
  const picked = selectAccountForReservation(sorted, amountCents, catalogKeyHint);
  if (!picked) {
    return { ok: false, error: 'Kein Budgetkonto mit ausreichend verfügbarem Betrag.' };
  }
  return { ok: true, data: picked };
}

export type ReserveForAssignmentInput = {
  tenantId: string;
  clientId: string;
  visitId: string;
  amountCents: number;
  catalogKey?: string | null;
  budgetAccountId?: string | null;
  assignmentDate?: string;
  createdBy?: string | null;
};

/** Plan/Reserve — when assignment is created (not draft). */
export async function reserveForAssignment(
  input: ReserveForAssignmentInput,
): Promise<ServiceResult<ClientBudgetTransaction>> {
  return runService(async () => {
    const { tenantId, clientId, visitId, amountCents, catalogKey, budgetAccountId, createdBy } = input;
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    if (amountCents <= 0) return { ok: false, error: 'Reservierungsbetrag muss positiv sein.' };

    const asOf = input.assignmentDate
      ? new Date(`${input.assignmentDate.slice(0, 10)}T12:00:00.000Z`)
      : new Date();

    let account: ClientBudgetAccount;

    if (budgetAccountId) {
      const existing = await findActiveVisitReservationForAccount(tenantId, visitId, budgetAccountId);
      if (existing) {
        return { ok: true, data: mapTransactionRow(existing) };
      }
      const loaded = await loadAccountById(tenantId, budgetAccountId);
      if (!loaded) return { ok: false, error: 'Budgetkonto nicht gefunden.' };
      account = loaded;
    } else {
      const accountResult = await resolveAccountForAmount(
        tenantId,
        clientId,
        amountCents,
        catalogKey,
        asOf,
      );
      if (!accountResult.ok) return accountResult;
      account = accountResult.data;

      const existingForAccount = await findActiveVisitReservationForAccount(
        tenantId,
        visitId,
        account.id,
      );
      if (existingForAccount) {
        return { ok: true, data: mapTransactionRow(existingForAccount) };
      }
    }
    const available = computeAvailableCents(account);
    if (available < amountCents) {
      return { ok: false, error: 'Budget nicht ausreichend für Reservierung.' };
    }

    const balanceAfter = available - amountCents;
    const txResult = await insertTransaction({
      tenantId,
      clientId,
      budgetAccountId: account.id,
      transactionType: 'reservation',
      amountCents,
      balanceAfterCents: balanceAfter,
      referenceType: 'assist_visit',
      referenceId: visitId,
      lifecycleStatus: 'geplant',
      note: 'Budget reserviert für geplanten Einsatz',
      createdBy,
    });
    if (!txResult.ok) return txResult;

    const patch = await patchAccountBalances(tenantId, account.id, { reservedDelta: amountCents });
    if (!patch.ok) return patch;

    await writeBillingAuditLog(
      tenantId,
      clientId,
      'reserve_assignment',
      'client_budget_transactions',
      txResult.data.id,
      { visitId, amountCents, catalogKey: account.catalogKey },
      createdBy,
    );

    await refreshClientBillingWarningsAfterBudgetChange(tenantId, clientId);
    return txResult;
  });
}

async function markAssignmentExecutedViaRpc(
  tenantId: string,
  visitId: string,
  actorEmployeeId?: string | null,
): Promise<ServiceResult<number>> {
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const { data, error } = await client.rpc('mark_assist_visit_budget_executed', {
    p_tenant_id: tenantId,
    p_visit_id: visitId,
    p_actor_employee_id: actorEmployeeId ?? null,
  });

  if (error) {
    if (isSupabaseMissingTableError(error)) {
      return { ok: false, error: 'Budget-RPC fehlt — Migration 0221 anwenden.' };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return { ok: true, data: typeof data === 'number' ? data : Number(data ?? 0) };
}

/** Execute — assignment completed; reservation stays, lifecycle moves to durchgefuehrt (no final consume). */
export async function markAssignmentExecuted(
  tenantId: string,
  visitId: string,
  createdBy?: string | null,
): Promise<ServiceResult<ClientBudgetTransaction | null>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    const reservations = await findActiveVisitReservations(tenantId, visitId);
    if (reservations.length === 0) return { ok: true, data: null };

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const rpcResult = await markAssignmentExecutedViaRpc(tenantId, visitId, createdBy);
    if (rpcResult.ok && rpcResult.data > 0) {
      for (const reservation of reservations) {
        await writeBillingAuditLog(
          tenantId,
          reservation.client_id as string,
          'assignment_executed',
          'client_budget_transactions',
          reservation.id as string,
          { visitId, lifecycleStatus: 'durchgefuehrt', via: 'rpc' },
          createdBy,
        );
      }
    } else {
      let directUpdated = 0;
      for (const reservation of reservations) {
        const { error } = await fromUnknownTable(client, 'client_budget_transactions')
          .update({ lifecycle_status: 'durchgefuehrt' })
          .eq('id', reservation.id as string);

        if (error) {
          const message =
            rpcResult.ok && rpcResult.data === 0
              ? 'Budget-Reservierung konnte nicht auf „durchgeführt“ gesetzt werden.'
              : rpcResult.error ?? toGermanSupabaseError(error);
          return { ok: false, error: message };
        }
        directUpdated += 1;

        await writeBillingAuditLog(
          tenantId,
          reservation.client_id as string,
          'assignment_executed',
          'client_budget_transactions',
          reservation.id as string,
          { visitId, lifecycleStatus: 'durchgefuehrt' },
          createdBy,
        );
      }
      if (directUpdated === 0) {
        return {
          ok: false,
          error:
            rpcResult.error ??
            'Budget-Reservierung konnte nicht auf „durchgeführt“ gesetzt werden.',
        };
      }
    }

    return {
      ok: true,
      data: mapTransactionRow({ ...reservations[0], lifecycle_status: 'durchgefuehrt' }),
    };
  });
}

export type ConsumeOnProofApprovalInput = {
  tenantId: string;
  proofId: string;
  visitId: string;
  clientId: string;
  amountCents?: number | null;
  invoiceId?: string | null;
  createdBy?: string | null;
};

/** Final consumption only after proof approval — NOT on plan/execute alone. */
export async function consumeOnProofApproval(
  input: ConsumeOnProofApprovalInput,
): Promise<ServiceResult<ClientBudgetTransaction>> {
  return runService(async () => {
    const { tenantId, proofId, visitId, clientId, invoiceId, createdBy } = input;
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const { data: existingUsage } = await fromUnknownTable(client, 'client_budget_transactions')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('reference_type', 'assist_visit_proof')
      .eq('reference_id', proofId)
      .eq('transaction_type', 'usage')
      .maybeSingle();

    if (existingUsage) {
      return { ok: true, data: mapTransactionRow(existingUsage as Record<string, unknown>) };
    }

    const reservations = await findActiveVisitReservations(tenantId, visitId);
    const totalReserved = reservations.reduce((sum, r) => sum + Number(r.amount_cents), 0);
    const amountCents =
      input.amountCents && input.amountCents > 0
        ? input.amountCents
        : totalReserved > 0
          ? totalReserved
          : 0;

    if (amountCents <= 0) {
      return { ok: false, error: 'Kein Betrag für Budgetverbrauch ermittelbar.' };
    }

    let accountId = reservations[0]?.budget_account_id as string | undefined;
    if (!accountId) {
      const accountResult = await resolveAccountForAmount(tenantId, clientId, amountCents);
      if (!accountResult.ok) return accountResult;
      accountId = accountResult.data.id;
    }

    const account = await loadAccountById(tenantId, accountId);
    if (!account) return { ok: false, error: 'Budgetkonto nicht gefunden.' };

    const available = computeAvailableCents(account);
    const balanceAfter = available - amountCents;

    const usageTx = await insertTransaction({
      tenantId,
      clientId,
      budgetAccountId: accountId,
      transactionType: 'usage',
      amountCents,
      balanceAfterCents: balanceAfter,
      referenceType: 'assist_visit_proof',
      referenceId: proofId,
      lifecycleStatus: 'nachgewiesen',
      note: 'Budgetverbrauch nach Freigabe Leistungsnachweis',
      createdBy,
      invoiceId,
    });
    if (!usageTx.ok) return usageTx;

    const reservedRelease = reservations.reduce((sum, r) => sum + Number(r.amount_cents), 0);
    await patchAccountBalances(tenantId, accountId, {
      usedDelta: amountCents,
      reservedDelta: reservedRelease > 0 ? -Math.min(reservedRelease, amountCents) : 0,
    });

    for (const reservation of reservations) {
      await fromUnknownTable(client, 'client_budget_transactions')
        .update({ lifecycle_status: 'nachgewiesen' })
        .eq('id', reservation.id as string);
    }

    await writeBillingAuditLog(
      tenantId,
      clientId,
      'consume_on_proof',
      'client_budget_transactions',
      usageTx.data.id,
      { proofId, visitId, amountCents, invoiceId },
      createdBy,
    );

    await refreshClientBillingWarningsAfterBudgetChange(tenantId, clientId);
    return usageTx;
  });
}

/** Release reservation on cancel/storno. */
export async function releaseReservation(
  tenantId: string,
  visitId: string,
  createdBy?: string | null,
  reason = 'Einsatz storniert',
): Promise<ServiceResult<ClientBudgetTransaction | null>> {
  return storno(tenantId, visitId, createdBy, reason);
}

export async function storno(
  tenantId: string,
  visitId: string,
  createdBy?: string | null,
  reason = 'Storno',
): Promise<ServiceResult<ClientBudgetTransaction | null>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    const reservations = await findActiveVisitReservations(tenantId, visitId);
    if (reservations.length === 0) return { ok: true, data: null };

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    let lastReleaseTx: ClientBudgetTransaction | null = null;

    for (const reservation of reservations) {
      const amountCents = Number(reservation.amount_cents);
      const accountId = reservation.budget_account_id as string;
      const clientId = reservation.client_id as string;

      const account = await loadAccountById(tenantId, accountId);
      const balanceAfter = account ? computeAvailableCents(account) + amountCents : null;

      const releaseTx = await insertTransaction({
        tenantId,
        clientId,
        budgetAccountId: accountId,
        transactionType: 'release',
        amountCents,
        balanceAfterCents: balanceAfter,
        referenceType: 'assist_visit',
        referenceId: visitId,
        lifecycleStatus: 'storniert',
        note: reason,
        createdBy,
      });
      if (!releaseTx.ok) return releaseTx;
      lastReleaseTx = releaseTx.data;

      await patchAccountBalances(tenantId, accountId, { reservedDelta: -amountCents });

      await fromUnknownTable(client, 'client_budget_transactions')
        .update({ lifecycle_status: 'storniert' })
        .eq('id', reservation.id as string);

      await writeBillingAuditLog(
        tenantId,
        clientId,
        'storno_reservation',
        'client_budget_transactions',
        releaseTx.data.id,
        { visitId, amountCents, reason },
        createdBy,
      );
    }

    const clientId = reservations[0].client_id as string;
    await refreshClientBillingWarningsAfterBudgetChange(tenantId, clientId);
    return { ok: true, data: lastReleaseTx };
  });
}

export async function linkTransactionToInvoice(
  tenantId: string,
  transactionId: string,
  invoiceId: string,
  createdBy?: string | null,
): Promise<ServiceResult<ClientBudgetTransaction>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const { data, error } = await fromUnknownTable(client, 'client_budget_transactions')
      .update({ invoice_id: invoiceId, lifecycle_status: 'abgerechnet' })
      .eq('tenant_id', tenantId)
      .eq('id', transactionId)
      .select('*')
      .single();

    if (error) return { ok: false, error: toGermanSupabaseError(error) };

    const tx = mapTransactionRow(data as Record<string, unknown>);
    await writeBillingAuditLog(
      tenantId,
      tx.clientId,
      'link_invoice',
      'client_budget_transactions',
      tx.id,
      { invoiceId },
      createdBy,
    );

    return { ok: true, data: tx };
  });
}

export function computeCanUseBudgetByCatalogKey(
  accounts: ClientBudgetAccount[],
  careGrade: import('@/types/assist/clientAssistBilling').ClientCareGrade | null,
): Record<string, boolean> {
  const flags: Record<string, boolean> = {};
  for (const account of accounts) {
    const available = computeAvailableCents(account) > 0;
    flags[account.catalogKey] =
      available
      && account.isEnabled !== false
      && !account.locked
      && account.status === 'active';
  }
  if (careGrade === 'pg1') {
    for (const key of Object.keys(flags)) {
      if (key.startsWith('umwandlung_')) flags[key] = false;
    }
  }
  return flags;
}
