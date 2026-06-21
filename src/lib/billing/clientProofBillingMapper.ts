/**
 * K.5 — map approved assist proofs to billing candidate inputs.
 */
import type { AssistVisitProofRow } from '@/types/assistExecutionPersistence';
import type { ProofBillingSourceSnapshot } from '@/types/clientBilling';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';

type VisitRow = {
  id: string;
  client_id: string;
  service_key: string | null;
  service_name: string | null;
  planned_start_at: string | null;
  planned_end_at: string | null;
  duration_minutes: number | null;
  budget_amount_cents: number | null;
};

function readSnapshotString(snapshot: Record<string, unknown>, key: string): string | null {
  const value = snapshot[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function parseDurationMinutes(start: string | null, end: string | null, fallback: number | null): number | null {
  if (start && end) {
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (Number.isFinite(ms) && ms > 0) return Math.round(ms / 60_000);
  }
  return fallback;
}

export function mapProofTasksToBillingSnapshot(
  snapshot: Record<string, unknown>,
): Array<{ title: string; status?: string }> {
  const raw = snapshot.tasks ?? snapshot.taskList ?? snapshot.completedTasks;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (typeof entry === 'string') return { title: entry };
      if (entry && typeof entry === 'object') {
        const obj = entry as Record<string, unknown>;
        const title = String(obj.title ?? obj.label ?? obj.name ?? '').trim();
        if (!title) return null;
        return {
          title,
          status: obj.status != null ? String(obj.status) : undefined,
        };
      }
      return null;
    })
    .filter((item): item is { title: string; status?: string } => item != null);
}

export function getProofBillingSourceSnapshot(
  proof: AssistVisitProofRow,
  visit: VisitRow | null,
): ProofBillingSourceSnapshot {
  const snap = proof.payloadSnapshot ?? {};
  const startTime =
    readSnapshotString(snap, 'serviceStartAt') ??
    readSnapshotString(snap, 'startTime') ??
    visit?.planned_start_at ??
    null;
  const endTime =
    readSnapshotString(snap, 'serviceEndAt') ??
    readSnapshotString(snap, 'endTime') ??
    visit?.planned_end_at ??
    null;
  const durationMinutes = parseDurationMinutes(
    startTime,
    endTime,
    visit?.duration_minutes ?? null,
  );
  const signed =
    Boolean(proof.signatureId) ||
    Boolean(readSnapshotString(snap, 'signerName')) ||
    Boolean(readSnapshotString(snap, 'signedAt'));
  const approved = proof.status === 'approved' || proof.status === 'exported';
  const released =
    proof.portalReleaseStatus === 'released' ||
    (proof.portalVisible && proof.status === 'exported');

  return {
    proofId: proof.id,
    visitId: proof.visitId,
    clientId: visit?.client_id ?? readSnapshotString(snap, 'clientId'),
    serviceTypeKey: visit?.service_key ?? readSnapshotString(snap, 'serviceKey'),
    serviceName: visit?.service_name ?? readSnapshotString(snap, 'serviceName'),
    clientName: readSnapshotString(snap, 'clientName'),
    employeeName: readSnapshotString(snap, 'employeeName'),
    signed,
    approved,
    released,
    proofStatus: proof.status,
    portalReleaseStatus: proof.portalReleaseStatus,
    startTime,
    endTime,
    durationMinutes,
    tasksSnapshot: mapProofTasksToBillingSnapshot(snap),
    documentationSnapshot: {
      documentationNote: readSnapshotString(snap, 'documentationNote'),
      notes: readSnapshotString(snap, 'notes'),
    },
    rateSource: visit?.budget_amount_cents != null ? 'visit_budget' : 'none',
    rateAmount: null,
  };
}

export function validateProofForBilling(proof: AssistVisitProofRow): { ok: true } | { ok: false; error: string } {
  if (!proof.id?.trim()) return { ok: false, error: 'Nachweis-ID fehlt.' };
  if (!proof.visitId?.trim()) return { ok: false, error: 'Einsatz-ID fehlt.' };
  if (proof.status === 'rejected' || proof.status === 'archived') {
    return { ok: false, error: 'Abgelehnte oder archivierte Nachweise sind nicht abrechnungsrelevant.' };
  }
  if (proof.status !== 'approved' && proof.status !== 'exported') {
    return { ok: false, error: 'Nur freigegebene Nachweise können abgerechnet werden.' };
  }
  return { ok: true };
}

export async function fetchVisitForBilling(
  tenantId: string,
  visitId: string,
): Promise<VisitRow | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data } = await fromUnknownTable(supabase, 'assist_visits')
    .select('id, client_id, service_key, service_name, planned_start_at, planned_end_at, duration_minutes, budget_amount_cents')
    .eq('tenant_id', tenantId)
    .eq('id', visitId)
    .maybeSingle();

  return (data as VisitRow | null) ?? null;
}

export type BillingCandidateDraft = {
  tenantId: string;
  clientId: string;
  clientServiceProfileId: string | null;
  serviceTypeId: string | null;
  proofId: string;
  visitId: string;
  proofDate: string | null;
  billingPeriodStart: string | null;
  billingPeriodEnd: string | null;
  durationMinutes: number | null;
  quantity: number | null;
  unit: string;
  rateAmount: number | null;
  amountPreviewCents: number;
  currency: string;
  budgetSettingId: string | null;
  budgetTypeId: string | null;
  billingTargetType: 'cost_carrier' | 'self_payer' | 'mixed' | 'internal';
  billingTargetId: string | null;
  sourceSnapshot: ProofBillingSourceSnapshot;
};

export function mapApprovedProofToBillingCandidate(
  tenantId: string,
  proof: AssistVisitProofRow,
  visit: VisitRow | null,
  options: {
    clientServiceProfileId?: string | null;
    serviceTypeId?: string | null;
    rateAmount?: number | null;
    unit?: string;
    currency?: string;
    budgetSettingId?: string | null;
    budgetTypeId?: string | null;
    billingTargetType?: BillingCandidateDraft['billingTargetType'];
  } = {},
): BillingCandidateDraft | { ok: false; error: string } {
  const validation = validateProofForBilling(proof);
  if (!validation.ok) return validation;

  const sourceSnapshot = getProofBillingSourceSnapshot(proof, visit);
  const clientId = visit?.client_id ?? sourceSnapshot.clientId;
  if (!clientId) return { ok: false, error: 'Klient:in für Nachweis nicht ermittelbar.' };

  const durationMinutes = sourceSnapshot.durationMinutes;
  const rateAmount = options.rateAmount ?? null;
  const quantity =
    durationMinutes != null && durationMinutes > 0
      ? Math.round((durationMinutes / 60) * 100) / 100
      : null;

  let amountPreviewCents = 0;
  if (rateAmount != null && quantity != null) {
    amountPreviewCents = Math.round(rateAmount * quantity * 100);
  } else if (visit?.budget_amount_cents != null) {
    amountPreviewCents = visit.budget_amount_cents;
  }

  const proofDate =
    sourceSnapshot.startTime?.slice(0, 10) ??
    proof.approvedAt?.slice(0, 10) ??
    proof.generatedAt?.slice(0, 10) ??
    null;

  return {
    tenantId,
    clientId,
    clientServiceProfileId: options.clientServiceProfileId ?? null,
    serviceTypeId: options.serviceTypeId ?? null,
    proofId: proof.id,
    visitId: proof.visitId,
    proofDate,
    billingPeriodStart: sourceSnapshot.startTime,
    billingPeriodEnd: sourceSnapshot.endTime,
    durationMinutes,
    quantity,
    unit: options.unit ?? 'hour',
    rateAmount,
    amountPreviewCents,
    currency: options.currency ?? 'EUR',
    budgetSettingId: options.budgetSettingId ?? null,
    budgetTypeId: options.budgetTypeId ?? null,
    billingTargetType: options.billingTargetType ?? 'cost_carrier',
    billingTargetId: null,
    sourceSnapshot,
  };
}

export { SERVICE_ERRORS };
