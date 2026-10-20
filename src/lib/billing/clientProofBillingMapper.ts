/**
 * K.5 — map approved assist proofs to billing candidate inputs.
 */
import type { AssistVisitProofRow } from '@/types/assistExecutionPersistence';
import type { ProofBillingSourceSnapshot, ConfirmedBillingProofSource } from '@/types/clientBilling';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { berlinDateKey } from '@/lib/employeeLogbook/employeeLogbookDate';

type VisitRow = {
  id: string;
  tenant_id: string;
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

export type { ConfirmedBillingProofSource } from '@/types/clientBilling';
function actualDurationMinutes(start: string | null, end: string | null, seconds: unknown): number | null {
  if (!start || !end) return null;
  const elapsed = Date.parse(end) - Date.parse(start);
  if (!Number.isFinite(elapsed) || elapsed < 0) return null;
  if (typeof seconds === 'number') {
    return Number.isFinite(seconds) && seconds >= 0 && seconds <= Math.round(elapsed / 1000)
      ? Math.round(seconds / 60) : null;
  }
  return Math.round(elapsed / 60_000);
}
export function isConfirmedBillingProofSource(proof: AssistVisitProofRow, source?: ConfirmedBillingProofSource): boolean {
  return Boolean(source && source.version === 'workflow-assignment-record-v1'
    && source.tenant_id === proof.tenantId && source.visit_id === proof.visitId && source.proof_id === proof.id
    && source.signature_id === proof.signatureId && source.proof_payload_hash === proof.payloadHash
    && typeof source.signature_payload_hash === 'string' && source.signature_payload_hash.startsWith('sha256:')
    && Number.isSafeInteger(source.actual_minutes) && source.actual_minutes >= 0
    && typeof source.pdf_storage_path === 'string' && Boolean(source.pdf_storage_path.trim())
    && typeof source.pdf_sha256 === 'string' && /^(sha256:)?[0-9a-f]{64}$/.test(source.pdf_sha256)
    && Number.isFinite(Date.parse(source.attested_at)) && Date.parse(source.attested_at) <= Date.now());
}

export function mapProofTasksToBillingSnapshot(
  snapshot: Record<string, unknown>,
): { title: string; status?: string }[] {
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
  confirmedSource?: ConfirmedBillingProofSource,
): ProofBillingSourceSnapshot {
  const snap = proof.payloadSnapshot ?? {};
  const times = snap.visitTimes && typeof snap.visitTimes === 'object' && !Array.isArray(snap.visitTimes)
    ? snap.visitTimes as Record<string, unknown> : {};
  const startTime = readSnapshotString(times, 'serviceStartedAt') ?? readSnapshotString(snap, 'serviceStartAt') ?? readSnapshotString(snap, 'startTime');
  const endTime = readSnapshotString(times, 'serviceEndedAt') ?? readSnapshotString(snap, 'serviceEndAt') ?? readSnapshotString(snap, 'endTime');
  const actualMinutes = actualDurationMinutes(startTime, endTime, times.serviceSeconds);
  const confirmed = isConfirmedBillingProofSource(proof, confirmedSource)
    && Date.parse(startTime ?? '') === Date.parse(confirmedSource?.service_started_at ?? '')
    && Date.parse(endTime ?? '') === Date.parse(confirmedSource?.service_ended_at ?? '')
    && actualMinutes === confirmedSource?.actual_minutes;
  const durationMinutes = actualMinutes;
  const signed = Boolean(confirmed);
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
    rateSource: 'none',
    ...(confirmed ? { confirmedSource } : {}),
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

  const { data, error } = await fromUnknownTable(supabase, 'assist_visits')
    .select('id, tenant_id, client_id, service_key, service_name, planned_start_at, planned_end_at, duration_minutes, budget_amount_cents')
    .eq('tenant_id', tenantId)
    .eq('id', visitId)
    .maybeSingle();

  if (error) throw new Error(toGermanSupabaseError(error));
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
    confirmedSource?: ConfirmedBillingProofSource;
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

  if (proof.tenantId !== tenantId || !visit || visit.tenant_id !== tenantId || visit.id !== proof.visitId
    || visit.client_id !== options.confirmedSource?.client_id || !isConfirmedBillingProofSource(proof, options.confirmedSource)) {
    return { ok: false, error: 'Die unveränderliche freigegebene Nachweisfassung wurde noch nicht vom Server bestätigt.' };
  }
  const sourceSnapshot = getProofBillingSourceSnapshot(proof, visit, options.confirmedSource);
  if (!sourceSnapshot.signed || sourceSnapshot.durationMinutes == null) {
    return { ok: false, error: 'Bestätigte Unterschrift und tatsächliches Leistungszeitpaar fehlen.' };
  }
  const clientId = visit?.client_id ?? sourceSnapshot.clientId;
  if (!clientId) return { ok: false, error: 'Klient:in für Nachweis nicht ermittelbar.' };

  const durationMinutes = sourceSnapshot.durationMinutes;
  const rateAmount = options.rateAmount ?? null;
  const quantity =
    durationMinutes != null && durationMinutes > 0
      ? Math.round((durationMinutes / 60) * 10_000) / 10_000
      : null;

  let amountPreviewCents = 0;
  if (rateAmount != null && quantity != null) {
    amountPreviewCents = Math.round(rateAmount * quantity * 100);
  }

  const proofDate = sourceSnapshot.startTime ? berlinDateKey(sourceSnapshot.startTime) : null;

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
