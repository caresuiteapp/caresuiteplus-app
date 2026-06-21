/**
 * K.5 — auditable budget consumption from billing candidates (ledger movements).
 */
import type { ServiceResult } from '@/types';
import type {
  CandidateBudgetMovementType,
  ClientBillingCandidate,
  ClientBillingCandidateBudgetMovement,
  ClientBudgetConsumptionSummary,
} from '@/types/clientBilling';
import { listClientBudgetSettings } from '@/lib/client/clientBudgetSettingsService';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isSupabaseMissingTableError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { runService } from '@/lib/services/serviceRunner';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { neverFinalizeInvoice } from './clientBillingReadinessService';

const CANDIDATE_MOVEMENTS_TABLE = 'client_billing_candidate_budget_movements';
const BUDGET_MOVEMENTS_TABLE = 'client_budget_movements';

type CandidateMovementRow = {
  id: string;
  tenant_id: string;
  billing_candidate_id: string;
  client_budget_setting_id: string;
  client_budget_movement_id: string | null;
  movement_type: CandidateBudgetMovementType;
  amount_cents: number;
  created_at: string;
};

function mapCandidateMovement(row: CandidateMovementRow): ClientBillingCandidateBudgetMovement {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    billingCandidateId: row.billing_candidate_id,
    clientBudgetSettingId: row.client_budget_setting_id,
    clientBudgetMovementId: row.client_budget_movement_id,
    movementType: row.movement_type,
    amountCents: Number(row.amount_cents),
    createdAt: row.created_at,
  };
}

const MOVEMENT_TO_BUDGET_TYPE: Record<CandidateBudgetMovementType, string> = {
  reserved: 'reservation',
  consumed: 'usage',
  released: 'release',
  adjusted: 'adjustment',
};

export function calculateBudgetConsumptionForCandidate(
  candidate: Pick<ClientBillingCandidate, 'amountPreviewCents' | 'durationMinutes' | 'budgetSettingId'>,
): { amountCents: number; budgetSettingId: string | null } {
  return {
    amountCents: candidate.amountPreviewCents,
    budgetSettingId: candidate.budgetSettingId,
  };
}

async function findExistingCandidateMovement(
  tenantId: string,
  candidateId: string,
  movementType: CandidateBudgetMovementType,
): Promise<CandidateMovementRow | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  const { data } = await fromUnknownTable(client, CANDIDATE_MOVEMENTS_TABLE)
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('billing_candidate_id', candidateId)
    .eq('movement_type', movementType)
    .maybeSingle();

  return (data as CandidateMovementRow | null) ?? null;
}

async function appendBudgetLedgerMovement(
  tenantId: string,
  clientId: string,
  budgetSettingId: string,
  movementType: CandidateBudgetMovementType,
  amountCents: number,
  candidateId: string,
  createdBy?: string | null,
): Promise<ServiceResult<string>> {
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const ledgerType = MOVEMENT_TO_BUDGET_TYPE[movementType];

  const { data: existing } = await fromUnknownTable(client, BUDGET_MOVEMENTS_TABLE)
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('reference_type', 'billing_candidate')
    .eq('reference_id', candidateId)
    .eq('movement_type', ledgerType)
    .maybeSingle();

  if (existing?.id) {
    return { ok: true, data: existing.id as string };
  }

  const { data, error } = await fromUnknownTable(client, BUDGET_MOVEMENTS_TABLE)
    .insert({
      tenant_id: tenantId,
      client_id: clientId,
      budget_setting_id: budgetSettingId,
      movement_type: ledgerType,
      amount_cents: amountCents,
      reference_type: 'billing_candidate',
      reference_id: candidateId,
      note: `K.5 ${movementType} für Abrechnungskandidat`,
      created_by: createdBy ?? null,
    })
    .select('id')
    .single();

  if (error) return { ok: false, error: toGermanSupabaseError(error) };

  const settingPatch =
    movementType === 'reserved'
      ? { reserved_cents: amountCents }
      : movementType === 'consumed'
        ? { used_cents: amountCents }
        : null;

  if (settingPatch) {
    const { data: setting } = await fromUnknownTable(client, 'client_budget_settings')
      .select('used_cents, reserved_cents, allocated_cents')
      .eq('id', budgetSettingId)
      .maybeSingle();

    if (setting) {
      const row = setting as { used_cents: number; reserved_cents: number; allocated_cents: number };
      const update =
        movementType === 'reserved'
          ? { reserved_cents: Number(row.reserved_cents) + amountCents }
          : movementType === 'consumed'
            ? {
                used_cents: Number(row.used_cents) + amountCents,
                reserved_cents: Math.max(0, Number(row.reserved_cents) - amountCents),
              }
            : {};
      if (Object.keys(update).length > 0) {
        await fromUnknownTable(client, 'client_budget_settings')
          .update(update)
          .eq('id', budgetSettingId);
      }
    }
  }

  return { ok: true, data: (data as { id: string }).id };
}

async function recordCandidateMovement(
  tenantId: string,
  candidate: ClientBillingCandidate,
  movementType: CandidateBudgetMovementType,
  createdBy?: string | null,
): Promise<ServiceResult<ClientBillingCandidateBudgetMovement>> {
  const guard = neverFinalizeInvoice();
  if (!guard.allowed) {
    /* budget movements are allowed — guard is for invoice finalization only */
  }

  if (!candidate.budgetSettingId) {
    return { ok: false, error: 'Kein Budgetsetting für Kandidat hinterlegt.' };
  }

  const existing = await findExistingCandidateMovement(tenantId, candidate.id, movementType);
  if (existing) return { ok: true, data: mapCandidateMovement(existing) };

  const { amountCents } = calculateBudgetConsumptionForCandidate(candidate);
  if (amountCents <= 0) return { ok: false, error: 'Betrag für Budgetbewegung ist null.' };

  const ledger = await appendBudgetLedgerMovement(
    tenantId,
    candidate.clientId,
    candidate.budgetSettingId,
    movementType,
    amountCents,
    candidate.id,
    createdBy,
  );
  if (!ledger.ok) return ledger;

  const client = getSupabaseClient();
  if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const { data, error } = await fromUnknownTable(client, CANDIDATE_MOVEMENTS_TABLE)
    .insert({
      tenant_id: tenantId,
      billing_candidate_id: candidate.id,
      client_budget_setting_id: candidate.budgetSettingId,
      client_budget_movement_id: ledger.data,
      movement_type: movementType,
      amount_cents: amountCents,
    })
    .select('*')
    .single();

  if (error) {
    if (isSupabaseMissingTableError(error)) {
      return { ok: false, error: 'Budgetbewegungs-Verknüpfung fehlt — Migration 0160 anwenden.' };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return { ok: true, data: mapCandidateMovement(data as CandidateMovementRow) };
}

export async function reserveBudgetForCandidate(
  tenantId: string,
  candidate: ClientBillingCandidate,
  createdBy?: string | null,
): Promise<ServiceResult<ClientBillingCandidateBudgetMovement>> {
  return runService(() => recordCandidateMovement(tenantId, candidate, 'reserved', createdBy));
}

export async function consumeBudgetForCandidate(
  tenantId: string,
  candidate: ClientBillingCandidate,
  createdBy?: string | null,
): Promise<ServiceResult<ClientBillingCandidateBudgetMovement>> {
  return runService(() => recordCandidateMovement(tenantId, candidate, 'consumed', createdBy));
}

export async function releaseBudgetReservation(
  tenantId: string,
  candidate: ClientBillingCandidate,
  createdBy?: string | null,
): Promise<ServiceResult<ClientBillingCandidateBudgetMovement>> {
  return runService(() => recordCandidateMovement(tenantId, candidate, 'released', createdBy));
}

export async function getBudgetMovementsForCandidate(
  tenantId: string,
  candidateId: string,
): Promise<ServiceResult<ClientBillingCandidateBudgetMovement[]>> {
  return runService(async () => {
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const { data, error } = await fromUnknownTable(client, CANDIDATE_MOVEMENTS_TABLE)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('billing_candidate_id', candidateId)
      .order('created_at', { ascending: false });

    if (error) {
      if (isSupabaseMissingTableError(error)) return { ok: true, data: [], tableMissing: true };
      return { ok: false, error: toGermanSupabaseError(error) };
    }

    return {
      ok: true,
      data: (data ?? []).map((row) => mapCandidateMovement(row as CandidateMovementRow)),
    };
  });
}

export async function getBudgetMovementsForProof(
  tenantId: string,
  proofId: string,
): Promise<ServiceResult<ClientBillingCandidateBudgetMovement[]>> {
  return runService(async () => {
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const { data: candidate } = await fromUnknownTable(client, 'client_billing_candidates')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('proof_id', proofId)
      .maybeSingle();

    if (!candidate?.id) return { ok: true, data: [] };
    return getBudgetMovementsForCandidate(tenantId, candidate.id as string);
  });
}

export async function getClientBudgetConsumptionSummary(
  tenantId: string,
  clientId: string,
  budgetYear = 2026,
): Promise<ServiceResult<ClientBudgetConsumptionSummary>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    const budgets = await listClientBudgetSettings(tenantId, clientId, budgetYear);
    if (!budgets.ok) return budgets;

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    let candidateReserved = 0;
    let candidateConsumed = 0;

    const { data: candidates } = await fromUnknownTable(client, 'client_billing_candidates')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId);

    for (const c of candidates ?? []) {
      const movements = await getBudgetMovementsForCandidate(tenantId, (c as { id: string }).id);
      if (movements.ok) {
        for (const m of movements.data) {
          if (m.movementType === 'reserved') candidateReserved += m.amountCents;
          if (m.movementType === 'consumed') candidateConsumed += m.amountCents;
        }
      }
    }

    const totalAllocated = budgets.data.reduce((s, b) => s + b.allocatedCents, 0);
    const totalUsed = budgets.data.reduce((s, b) => s + b.usedCents, 0);
    const totalReserved = budgets.data.reduce((s, b) => s + b.reservedCents, 0);

    return {
      ok: true,
      data: {
        clientId,
        budgetYear,
        totalAllocatedCents: totalAllocated,
        totalUsedCents: totalUsed,
        totalReservedCents: totalReserved,
        totalRemainingCents: totalAllocated - totalUsed - totalReserved,
        candidateReservedCents: candidateReserved,
        candidateConsumedCents: candidateConsumed,
      },
    };
  });
}
