/**
 * Persist and reserve assignment budget allocations — spec §16C/D.
 */
import type { RoleKey, ServiceResult } from '@/types';
import type {
  AssistBudgetAllocationResult,
  AssignmentBudgetAllocationRow,
  ManualBudgetAllocationOverride,
} from '@/types/assist/assignmentBudgetAllocation';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isSupabaseMissingTableError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { runService } from '@/lib/services/serviceRunner';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { enforcePermission } from '@/lib/permissions';
import { hasPermission } from '@/lib/permissions/check';
import {
  calculateAssistBudgetAllocation,
  calculateAssistBudgetAllocationFromProfile,
} from './calculateAssistBudgetAllocation';
import { getClientAssistBillingProfile } from './clientAssistBillingProfileService';
import {
  releaseReservation,
  reserveForAssignment,
} from './clientBudgetTransactionService';

function mapAllocationRow(row: Record<string, unknown>): AssignmentBudgetAllocationRow {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    assignmentId: row.assignment_id as string,
    clientId: row.client_id as string,
    budgetAccountId: (row.budget_account_id as string | null) ?? null,
    catalogKey: row.catalog_key as string,
    allocationStatus: row.allocation_status as string,
    plannedAmountCents: Number(row.planned_amount_cents),
    reservedAmountCents: Number(row.reserved_amount_cents),
    finalAmountCents: row.final_amount_cents != null ? Number(row.final_amount_cents) : null,
    priorityOrder: Number(row.priority_order),
    isManualOverride: Boolean(row.is_manual_override),
    overrideReason: (row.override_reason as string | null) ?? null,
  };
}

async function writeAllocationAuditLog(
  tenantId: string,
  clientId: string,
  assignmentId: string,
  action: string,
  payload: Record<string, unknown>,
  actorId?: string | null,
): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  await fromUnknownTable(client, 'client_billing_audit_log').insert({
    tenant_id: tenantId,
    client_id: clientId,
    action,
    entity_type: 'assignment_budget_allocations',
    entity_id: assignmentId,
    payload,
    actor_id: actorId ?? null,
  });
}

export type PersistAssignmentAllocationsInput = {
  tenantId: string;
  assignmentId: string;
  clientId: string;
  allocation: AssistBudgetAllocationResult;
  manualOverride?: ManualBudgetAllocationOverride | null;
  actorProfileId?: string | null;
};

export async function persistAssignmentBudgetAllocations(
  input: PersistAssignmentAllocationsInput,
): Promise<ServiceResult<AssignmentBudgetAllocationRow[]>> {
  return runService(async () => {
    const { tenantId, assignmentId, clientId, allocation, manualOverride, actorProfileId } = input;
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const lines = allocation.allocationProposal.filter((l) => l.amountCents > 0);
    if (lines.length === 0) return { ok: true, data: [] };

    const rows = lines.map((line) => ({
      tenant_id: tenantId,
      assignment_id: assignmentId,
      client_id: clientId,
      budget_account_id: line.budgetAccountId,
      catalog_key: line.catalogKey,
      allocation_status: 'planned',
      planned_amount_cents: line.amountCents,
      reserved_amount_cents: 0,
      priority_order: line.priorityOrder,
      is_manual_override: !!manualOverride,
      override_reason: manualOverride?.reason ?? null,
      metadata: { reason: line.reason, status: line.status },
    }));

    const { data, error } = await fromUnknownTable(client, 'assignment_budget_allocations')
      .insert(rows)
      .select('*');

    if (error) {
      if (isSupabaseMissingTableError(error)) {
        return { ok: false, error: 'assignment_budget_allocations fehlt — Migration 0178 anwenden.' };
      }
      return { ok: false, error: toGermanSupabaseError(error) };
    }

    if (manualOverride && allocation.auditRequired) {
      await writeAllocationAuditLog(
        tenantId,
        clientId,
        assignmentId,
        'manual_budget_override',
        { manualOverride, allocation: lines },
        actorProfileId,
      );
    }

    return { ok: true, data: (data ?? []).map((r) => mapAllocationRow(r as Record<string, unknown>)) };
  });
}

export type ReserveAssignmentBudgetInput = {
  tenantId: string;
  clientId: string;
  visitId: string;
  allocation: AssistBudgetAllocationResult;
  assignmentDate?: string;
  createdBy?: string | null;
  actorRoleKey?: RoleKey | null;
};

export async function reserveAssignmentBudget(
  input: ReserveAssignmentBudgetInput,
): Promise<ServiceResult<void>> {
  return runService(async () => {
    const denied = guardServiceTenant(input.tenantId);
    if (denied) return denied;

    const permDenied = enforcePermission<void>(
      input.actorRoleKey,
      'assist.assignment.budget.auto_allocate',
    );
    if (permDenied && !hasPermission(input.actorRoleKey, 'assist.assignments.manage')) {
      return permDenied;
    }

    const reservableLines = input.allocation.allocationProposal.filter(
      (l) =>
        l.amountCents > 0
        && l.budgetAccountId
        && l.catalogKey !== 'kulanz'
        && l.catalogKey !== 'ungeklaert',
    );

    for (const line of reservableLines) {
      const result = await reserveForAssignment({
        tenantId: input.tenantId,
        clientId: input.clientId,
        visitId: input.visitId,
        amountCents: line.amountCents,
        catalogKey: line.catalogKey,
        assignmentDate: input.assignmentDate,
        createdBy: input.createdBy,
        budgetAccountId: line.budgetAccountId ?? undefined,
      });
      if (!result.ok) return result;
    }

    const client = getSupabaseClient();
    if (client) {
      for (const line of reservableLines) {
        await fromUnknownTable(client, 'assignment_budget_allocations')
          .update({
            allocation_status: 'reserved',
            reserved_amount_cents: line.amountCents,
          })
          .eq('tenant_id', input.tenantId)
          .eq('assignment_id', input.visitId)
          .eq('catalog_key', line.catalogKey);
      }
    }

    return { ok: true, data: undefined };
  });
}

export async function releaseAssignmentBudgetReservation(
  tenantId: string,
  visitId: string,
  createdBy?: string | null,
  reason = 'Einsatz storniert',
): Promise<ServiceResult<void>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    await releaseReservation(tenantId, visitId, createdBy, reason);

    const client = getSupabaseClient();
    if (client) {
      await fromUnknownTable(client, 'assignment_budget_allocations')
        .update({ allocation_status: 'released' })
        .eq('tenant_id', tenantId)
        .eq('assignment_id', visitId)
        .in('allocation_status', ['planned', 'reserved']);
    }

    return { ok: true, data: undefined };
  });
}

export type PrepareVisitBudgetInput = {
  tenantId: string;
  clientId: string;
  assignmentDate: string;
  plannedStart: string;
  plannedEnd: string;
  plannedMinutes: number;
  hourlyRateCents?: number | null;
  serviceType?: string | null;
  manualOverride?: ManualBudgetAllocationOverride | null;
  actorRoleKey?: RoleKey | null;
};

export async function prepareVisitBudgetAllocation(
  input: PrepareVisitBudgetInput,
): Promise<ServiceResult<AssistBudgetAllocationResult>> {
  const profileResult = await getClientAssistBillingProfile({
    tenantId: input.tenantId,
    clientId: input.clientId,
    date: input.assignmentDate,
  });
  if (!profileResult.ok) return profileResult;

  const { resolveHourlyRateCents } = await import('./calculateAssistBudgetAllocation');
  const hourlyRateCents =
    input.hourlyRateCents && input.hourlyRateCents > 0
      ? input.hourlyRateCents
      : resolveHourlyRateCents(profileResult.data, input.serviceType);

  const data = calculateAssistBudgetAllocationFromProfile(profileResult.data, {
    plannedStart: input.plannedStart,
    plannedEnd: input.plannedEnd,
    plannedMinutes: input.plannedMinutes,
    hourlyRateCents,
    serviceType: input.serviceType,
    manualOverride: input.manualOverride,
    actorRoleKey: input.actorRoleKey,
    assignmentDate: input.assignmentDate,
  });

  if (!data.canSave) {
    return {
      ok: false,
      error: data.warnings[0] ?? 'Budgetverteilung nicht speicherbar.',
    };
  }

  return { ok: true, data };
}

export async function listAssignmentBudgetAllocations(
  tenantId: string,
  assignmentId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<AssignmentBudgetAllocationRow[]>> {
  const denied = enforcePermission<AssignmentBudgetAllocationRow[]>(
    actorRoleKey,
    'assist.assignment.budget.view',
  );
  if (denied) return denied;

  return runService(async () => {
    const tenantDenied = guardServiceTenant(tenantId);
    if (tenantDenied) return tenantDenied;

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const { data, error } = await fromUnknownTable(client, 'assignment_budget_allocations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('assignment_id', assignmentId)
      .order('priority_order', { ascending: true });

    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: (data ?? []).map((r) => mapAllocationRow(r as Record<string, unknown>)) };
  });
}

export { calculateAssistBudgetAllocation, calculateAssistBudgetAllocationFromProfile };
export {
  expandVisitRecurrenceDates,
  calculateSeriesBudgetAllocations,
  resolveHourlyRateCents,
  computeAssignmentAmountCents,
} from './calculateAssistBudgetAllocation';
