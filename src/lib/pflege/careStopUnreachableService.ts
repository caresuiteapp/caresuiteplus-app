import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';

export type ContactAttemptChannel = 'doorbell' | 'phone' | 'contact_person' | 'office' | 'emergency_service' | 'other';
export type ContactAttemptOutcome = 'no_answer' | 'failed' | 'reached';
export type UnreachableRiskLevel = 'no_acute_indication' | 'unclear' | 'urgent';
export type UnreachableFeedbackState = 'none' | 'client' | 'contact_person' | 'office' | 'emergency_service';
export type FollowUpPriority = 'routine' | 'today' | 'urgent';

export type ContactAttemptInput = Readonly<{
  stopId: string; channel: ContactAttemptChannel; targetLabel: string; outcome: ContactAttemptOutcome;
  detail: string; responseDetail: string; requestId: string;
}>;
export type UnreachableReportInput = Readonly<{
  stopId: string; expectedStopUpdatedAt: string; circumstances: string; riskLevel: UnreachableRiskLevel; riskDetail: string;
  feedbackState: UnreachableFeedbackState; feedbackDetail: string; followUpAction: string; followUpAssignee: string;
  followUpPriority: FollowUpPriority; followUpDueAt: string; requestId: string;
}>;
export type CareStopUnreachableContext = Readonly<{
  stopId: string; tourId: string; clientId: string; stopStatus: string; stopUpdatedAt: string; actualStartedAt: string | null; canRecord: boolean;
  attempts: readonly Readonly<{ id: string; channel: ContactAttemptChannel; targetLabel: string; outcome: ContactAttemptOutcome; detail: string; responseDetail: string | null; recordedByName: string; recordedAt: string }>[];
  report: Readonly<{ id: string; circumstances: string; riskLevel: UnreachableRiskLevel; riskDetail: string; feedbackState: UnreachableFeedbackState; feedbackDetail: string | null; serviceOutcome: 'not_delivered'; recordedByName: string; recordedAt: string }> | null;
  followUp: Readonly<{ id: string; action: string; assigneeLabel: string; priority: FollowUpPriority; dueAt: string; status: 'open'; createdByName: string; createdAt: string }> | null;
}>;

type RpcError = { code?: string; message?: string } | null;
type RpcClient = { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: RpcError }> };
export const newCareStopUnreachableRequestId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
function errorMessage(error: RpcError): string {
  if (error?.code === 'PGRST202') return 'Die strukturierte Nichtbesuchsdokumentation ist in der Datenbank noch nicht freigeschaltet.';
  if (['23514','40001','P0001'].includes(error?.code ?? '') && error?.message) return error.message;
  return toGermanSupabaseError(error);
}
async function rpc<T>(name: string, args: Record<string, unknown>): Promise<ServiceResult<T>> {
  const client = getSupabaseClient() as unknown as RpcClient | null;
  if (!client) return { ok: false, error: 'Keine Datenbankverbindung.' };
  try { const { data, error } = await client.rpc(name, args); return error || data == null ? { ok: false, error: errorMessage(error) } : { ok: true, data: data as T }; }
  catch { return { ok: false, error: 'Verbindung unterbrochen. Bitte den Einsatz neu laden und den gespeicherten Stand prüfen.' }; }
}
function guard<T>(tenantId: string, role?: RoleKey | null): ServiceResult<T> | null {
  const denied = enforcePermission<T>(role, 'pflege.plans.manage'); if (denied) return denied;
  const invalid = guardServiceTenant(tenantId); if (invalid) return invalid as ServiceResult<T>;
  return getServiceMode() === 'supabase' ? null : { ok: false, error: 'Die Nichtbesuchsdokumentation ist ausschließlich live verfügbar.' };
}
export const fetchCareStopUnreachableContext = (tenantId: string, role: RoleKey | null | undefined, stopId: string) =>
  guard<CareStopUnreachableContext>(tenantId, role) ?? rpc<CareStopUnreachableContext>('get_ambulatory_care_stop_unreachable_context', { p_stop_id: stopId });
export const fetchPortalCareStopUnreachableContext = (stopId: string) =>
  rpc<CareStopUnreachableContext>('get_ambulatory_care_stop_unreachable_context', { p_stop_id: stopId });
export function recordCareStopContactAttempt(tenantId: string, role: RoleKey | null | undefined, input: ContactAttemptInput) {
  const denied = guard<{ id: string; recordedAt: string; duplicate: boolean }>(tenantId, role); if (denied) return Promise.resolve(denied);
  return recordAttempt(input);
}
export const recordPortalCareStopContactAttempt = (input: ContactAttemptInput) => recordAttempt(input);
function recordAttempt(input: ContactAttemptInput) {
  return rpc<{ id: string; recordedAt: string; duplicate: boolean }>('record_ambulatory_care_stop_contact_attempt', {
    p_stop_id: input.stopId, p_channel: input.channel, p_target_label: input.targetLabel, p_outcome: input.outcome,
    p_detail: input.detail, p_response_detail: input.responseDetail, p_request_id: input.requestId,
  });
}
export function reportCareStopUnreachable(tenantId: string, role: RoleKey | null | undefined, input: UnreachableReportInput) {
  const denied = guard<{ id: string; followUpId: string; recordedAt: string; duplicate: boolean; serviceOutcome: 'not_delivered' }>(tenantId, role); if (denied) return Promise.resolve(denied);
  return report(input);
}
export const reportPortalCareStopUnreachable = (input: UnreachableReportInput) => report(input);
function report(input: UnreachableReportInput) {
  return rpc<{ id: string; followUpId: string; recordedAt: string; duplicate: boolean; serviceOutcome: 'not_delivered' }>('report_ambulatory_care_stop_unreachable', {
    p_stop_id: input.stopId, p_expected_stop_updated_at: input.expectedStopUpdatedAt, p_circumstances: input.circumstances,
    p_risk_level: input.riskLevel, p_risk_detail: input.riskDetail, p_feedback_state: input.feedbackState,
    p_feedback_detail: input.feedbackDetail, p_follow_up_action: input.followUpAction, p_follow_up_assignee: input.followUpAssignee,
    p_follow_up_priority: input.followUpPriority, p_follow_up_due_at: input.followUpDueAt, p_request_id: input.requestId,
  });
}
