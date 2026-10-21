import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';

export type CareStopTaskOutcome = 'performed' | 'not_performed' | 'refused';
export type CareStopTaskExecutionInput = Readonly<{
  bindingId: string; outcome: CareStopTaskOutcome; resultDetail: string;
  hasDeviation: boolean; deviationReason: string; observation: string; requestId: string;
}>;
export type CareStopTaskContext = Readonly<{
  stopId: string; tourId: string; clientId: string; stopStatus: string; openingId: string | null;
  prepared: boolean; availableTaskCount: number;
  tasks: readonly Readonly<{
    bindingId: string; planItemId: string; planItemUpdatedAt: string; boundAt: string;
    plannedTask: Readonly<{ title?: string; intervention?: string; timing?: string; frequency?: string; responsibleRole?: string; warningSigns?: string; escalationPath?: string; [key: string]: unknown }>;
    execution: Readonly<{ id: string; outcome: CareStopTaskOutcome; resultDetail: string; hasDeviation: boolean; deviationReason: string | null; observation: string | null; recordedByName: string; recordedAt: string }> | null;
  }>[];
}>;

type RpcError = { code?: string; message?: string } | null;
type RpcClient = { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: RpcError }> };
export const newCareStopTaskRequestId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
function errorMessage(error: RpcError): string {
  if (error?.code === 'PGRST202') return 'Die Einzeldokumentation der Planaufgaben ist in der Datenbank noch nicht freigeschaltet.';
  if (['23514','40001','P0001'].includes(error?.code ?? '') && error?.message) return error.message;
  return toGermanSupabaseError(error);
}
async function rpc<T>(name: string, args: Record<string, unknown>): Promise<ServiceResult<T>> {
  const client = getSupabaseClient() as unknown as RpcClient | null;
  if (!client) return { ok: false, error: 'Keine Datenbankverbindung.' };
  try { const { data, error } = await client.rpc(name, args); return error || data == null ? { ok: false, error: errorMessage(error) } : { ok: true, data: data as T }; }
  catch { return { ok: false, error: 'Verbindung unterbrochen. Aufgaben neu laden und den gespeicherten Stand prüfen.' }; }
}
function guard<T>(tenantId: string, role?: RoleKey | null): ServiceResult<T> | null {
  const denied = enforcePermission<T>(role, 'pflege.plans.manage'); if (denied) return denied;
  const invalid = guardServiceTenant(tenantId); if (invalid) return invalid as ServiceResult<T>;
  return getServiceMode() === 'supabase' ? null : { ok: false, error: 'Die Einzeldokumentation ist ausschließlich live verfügbar.' };
}
export const fetchCareStopTaskContext = (tenantId: string, role: RoleKey | null | undefined, stopId: string) =>
  guard<CareStopTaskContext>(tenantId, role) ?? rpc<CareStopTaskContext>('get_ambulatory_care_stop_task_context', { p_stop_id: stopId });
export const fetchPortalCareStopTaskContext = (stopId: string) => rpc<CareStopTaskContext>('get_ambulatory_care_stop_task_context', { p_stop_id: stopId });
export const prepareCareStopTasks = (tenantId: string, role: RoleKey | null | undefined, stopId: string) =>
  guard<CareStopTaskContext>(tenantId, role) ?? rpc<CareStopTaskContext>('prepare_ambulatory_care_stop_tasks', { p_stop_id: stopId });
export const preparePortalCareStopTasks = (stopId: string) => rpc<CareStopTaskContext>('prepare_ambulatory_care_stop_tasks', { p_stop_id: stopId });
export function recordCareStopTaskExecution(tenantId: string, role: RoleKey | null | undefined, input: CareStopTaskExecutionInput) {
  const denied = guard<{ id: string; recordedAt: string; duplicate: boolean }>(tenantId, role); if (denied) return Promise.resolve(denied);
  return record(input);
}
export const recordPortalCareStopTaskExecution = (input: CareStopTaskExecutionInput) => record(input);
function record(input: CareStopTaskExecutionInput) {
  return rpc<{ id: string; recordedAt: string; duplicate: boolean }>('record_ambulatory_care_stop_task_execution', {
    p_binding_id: input.bindingId, p_outcome: input.outcome, p_result_detail: input.resultDetail,
    p_has_deviation: input.hasDeviation, p_deviation_reason: input.deviationReason,
    p_observation: input.observation, p_request_id: input.requestId,
  });
}
