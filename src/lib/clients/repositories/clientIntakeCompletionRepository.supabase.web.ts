import type { ServiceResult } from '@/types';
import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isUuid } from '@/lib/validation/uuid';

type Row = Record<string, unknown>;
type RpcClient = { rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: unknown }> };
export type IntakeCompletionState = Readonly<{
  id: string;
  requestId: string;
  status: 'prepared' | 'active';
  leadUpdatedAt: string;
}>;

const unresolved = 'Der serverseitige Aufnahmeabschluss ist nicht vollständig bestätigt. Bitte prüfen Sie dieselbe Akte; starten Sie keine zweite Aufnahme.';
const row = (value: unknown): value is Row => value !== null && typeof value === 'object' && !Array.isArray(value);
const nativeTime = (value: unknown): value is string => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:?\d{2})$/.test(value)
  && Number.isFinite(Date.parse(value));
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function admissionDecision(form: ClientIntakeFormData): Row {
  return {
    care_need_summary: form.intakeCareNeedSummary.trim(),
    capacity_status: form.intakeCapacityStatus,
    capacity_reference: form.intakeCapacityReference.trim(),
    admission_decision: form.intakeAdmissionDecision,
    admission_reason: form.intakeAdmissionDecisionReason.trim(),
    service_start: form.serviceStart,
    contract_type: form.intakeContractType,
  };
}

function prerequisites(form: ClientIntakeFormData): boolean {
  const decision = admissionDecision(form);
  return String(decision.care_need_summary).length >= 10
    && decision.capacity_status === 'confirmed'
    && String(decision.capacity_reference).length >= 3
    && decision.admission_decision === 'accepted'
    && String(decision.admission_reason).length >= 10
    && /^\d{4}-\d{2}-\d{2}$/.test(String(decision.service_start))
    && String(decision.contract_type).length > 0;
}

function decode(value: unknown, clientId: string, requestId: string): IntakeCompletionState | null {
  if (!row(value) || value.client_id !== clientId || value.request_id !== requestId
    || !['prepared', 'active'].includes(String(value.status)) || !nativeTime(value.lead_updated_at)) return null;
  return Object.freeze({ id: clientId, requestId, status: value.status as 'prepared' | 'active', leadUpdatedAt: value.lead_updated_at });
}

export async function prepareClientIntakeCompletion(
  tenantId: string,
  clientId: string,
  actorId: string,
  requestId: string,
  identityReviewId: string,
  leadUpdatedAt: string,
  form: ClientIntakeFormData,
  documentsRequestId: string,
): Promise<ServiceResult<IntakeCompletionState>> {
  try {
    if (![tenantId, clientId, actorId, requestId, identityReviewId, documentsRequestId].every(isUuid)
      || !nativeTime(leadUpdatedAt) || !prerequisites(form)) return { ok: false, error: unresolved };
    const supabase = getSupabaseClient();
    if (!supabase) return { ok: false, error: unresolved };
    const captured = copy(form);
    const result = await (supabase as unknown as RpcClient).rpc('web_prepare_packet_client_intake_completion', {
      p_tenant_id: tenantId,
      p_client_id: clientId,
      p_actor_profile_id: actorId,
      p_request_id: requestId,
      p_identity_review_id: identityReviewId,
      p_expected_lead_updated_at: leadUpdatedAt,
      p_decision: admissionDecision(captured),
      p_document_evidence: captured.intakeDocuments,
      p_document_request_id: documentsRequestId,
    });
    if (result.error || getSupabaseClient() !== supabase) return { ok: false, error: unresolved };
    const state = decode(result.data, clientId, requestId);
    return state?.status === 'prepared' ? { ok: true, data: state } : { ok: false, error: unresolved };
  } catch { return { ok: false, error: unresolved }; }
}

export async function finalizeClientIntakeCompletion(
  tenantId: string,
  clientId: string,
  actorId: string,
  requestId: string,
  expectedLeadUpdatedAt: string,
): Promise<ServiceResult<IntakeCompletionState>> {
  try {
    if (![tenantId, clientId, actorId, requestId].every(isUuid) || !nativeTime(expectedLeadUpdatedAt)) return { ok: false, error: unresolved };
    const supabase = getSupabaseClient();
    if (!supabase) return { ok: false, error: unresolved };
    const result = await (supabase as unknown as RpcClient).rpc('web_finalize_client_intake_completion', {
      p_tenant_id: tenantId, p_client_id: clientId, p_actor_profile_id: actorId,
      p_request_id: requestId, p_expected_lead_updated_at: expectedLeadUpdatedAt,
    });
    if (result.error || getSupabaseClient() !== supabase || !row(result.data) || !row(result.data.row)
      || result.data.row.id !== clientId || result.data.row.tenant_id !== tenantId || result.data.row.status !== 'active'
      || result.data.row.updated_by !== actorId) return { ok: false, error: unresolved };
    const state = decode(result.data, clientId, requestId);
    return state?.status === 'active' ? { ok: true, data: state } : { ok: false, error: unresolved };
  } catch { return { ok: false, error: unresolved }; }
}

export async function confirmClientIntakeCompletion(
  tenantId: string,
  clientId: string,
  actorId: string,
  requestId: string,
): Promise<ServiceResult<IntakeCompletionState>> {
  try {
    if (![tenantId, clientId, actorId, requestId].every(isUuid)) return { ok: false, error: unresolved };
    const supabase = getSupabaseClient();
    if (!supabase) return { ok: false, error: unresolved };
    const result = await (supabase as unknown as RpcClient).rpc('web_confirm_client_intake_completion', {
      p_tenant_id: tenantId, p_client_id: clientId, p_actor_profile_id: actorId, p_request_id: requestId,
    });
    if (result.error || getSupabaseClient() !== supabase) return { ok: false, error: unresolved };
    const state = decode(result.data, clientId, requestId);
    if (!state || state.status !== 'active' || !row(result.data) || !row(result.data.row)
      || result.data.row.id !== clientId || result.data.row.tenant_id !== tenantId
      || result.data.row.status !== 'active' || result.data.row.updated_by !== actorId) return { ok: false, error: unresolved };
    return { ok: true, data: state };
  } catch { return { ok: false, error: unresolved }; }
}
