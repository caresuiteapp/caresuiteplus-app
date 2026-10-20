import type { ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import type { VisitTaskStatus } from './visitTypes';
import type { VisitDispositionDetail } from './visitTypes';
import { releaseAdministrativeDeferredClientSignatureRequest } from '@/lib/portal/deferredVisitClientSignatureService';

export type AdministrativeTimes = {
  onTheWayAt?: string | null; arrivedAt?: string | null; startedAt: string; endedAt: string;
  pauseMinutes: number; travelMinutes?: number; confirmOverlap?: boolean;
};

const AUTOMATIC_ADMIN_AUDIT_REASON = 'Administrative Nachbearbeitung';

const ADMINISTRATIVE_ERROR_MESSAGES = [
  'Begründung ist erforderlich',
  'Dokumentation und Begründung sind erforderlich',
  'Keine Berechtigung',
  'Einsatz nicht gefunden',
  'Aufgabe nicht gefunden',
  'Mitarbeitenden-Zuordnung fehlt',
  'Ungültige Zeitfolge',
  'Pausen überschreiten die Einsatzdauer',
  'Gültige Ist-Zeiten fehlen',
  'Pflichtaufgaben sind noch offen',
  'Dokumentation ist nicht vollständig',
  'Signatur oder verifizierter Nachweis fehlt',
  'Signaturanforderung ist im Klient:innenportal ausstehend',
  'Keine Aufgabenänderungen übergeben',
] as const;

function toAdministrativeError(error: unknown): string {
  const message =
    error && typeof error === 'object' && 'message' in error
      ? String((error as { message?: unknown }).message ?? '')
      : '';
  const known = ADMINISTRATIVE_ERROR_MESSAGES.find((value) => message.includes(value));
  return known ?? toGermanSupabaseError(error as never);
}

export function validateAdministrativeTimes(input: AdministrativeTimes): string | null {
  const start = Date.parse(input.startedAt); const end = Date.parse(input.endedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) return 'Einsatzbeginn muss vor Einsatzende liegen.';
  if (input.pauseMinutes < 0 || input.pauseMinutes * 60_000 > end - start) return 'Die Pausendauer ist ungültig.';
  const way = input.onTheWayAt ? Date.parse(input.onTheWayAt) : null;
  const arrived = input.arrivedAt ? Date.parse(input.arrivedAt) : null;
  if (way != null && arrived != null && way > arrived) return 'Unterwegs muss vor Angekommen liegen.';
  if (arrived != null && arrived > start) return 'Angekommen muss vor Einsatzbeginn liegen.';
  return null;
}

export async function correctAdministrativeVisitTimes(visitId: string, input: AdministrativeTimes): Promise<ServiceResult<{ overlap: boolean; netMinutes?: number }>> {
  const validation = validateAdministrativeTimes(input);
  if (validation) return { ok: false, error: validation };
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Datenbank ist nicht verfügbar.' };
  const { data, error } = await supabase.rpc('admin_correct_assist_visit_times' as never, {
    p_visit_id: visitId, p_on_the_way_at: input.onTheWayAt ?? null, p_arrived_at: input.arrivedAt ?? null,
    p_started_at: input.startedAt, p_ended_at: input.endedAt, p_pause_minutes: input.pauseMinutes,
    p_travel_minutes: input.travelMinutes ?? 0, p_reason: AUTOMATIC_ADMIN_AUDIT_REASON, p_confirm_overlap: Boolean(input.confirmOverlap),
  } as never);
  if (error) return { ok: false, error: toAdministrativeError(error) };
  const result = data as { ok: boolean; overlap?: boolean; net_minutes?: number };
  if (!result.ok && result.overlap) return { ok: true, data: { overlap: true } };
  return { ok: true, data: { overlap: false, netMinutes: result.net_minutes } };
}

export async function requestClientVisitSignature(tenantId: string, visit: VisitDispositionDetail): Promise<ServiceResult<{ id: string }>> {
  const released = await releaseAdministrativeDeferredClientSignatureRequest(tenantId, visit);
  if (!released.ok) return released;
  return { ok: true, data: { id: released.data.proofId } };
}

async function runAdministrativeRpc(name: string, params: Record<string, unknown>): Promise<ServiceResult<void>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Datenbank ist nicht verfügbar.' };
  const { error } = await supabase.rpc(name as never, params as never);
  return error ? { ok: false, error: toAdministrativeError(error) } : { ok: true, data: undefined };
}

export function appendAdministrativeDocumentation(visitId: string, content: string) {
  if (!content.trim()) return Promise.resolve<ServiceResult<void>>({ ok: false, error: 'Dokumentation ist erforderlich.' });
  return runAdministrativeRpc('admin_append_assist_visit_documentation', { p_visit_id: visitId, p_content: content.trim(), p_reason: AUTOMATIC_ADMIN_AUDIT_REASON });
}

export function updateAdministrativeTask(visitId: string, taskId: string, status: string) {
  return runAdministrativeRpc('admin_update_assist_visit_task', { p_visit_id: visitId, p_task_id: taskId, p_status: status, p_reason: AUTOMATIC_ADMIN_AUDIT_REASON });
}

export async function bulkUpdateAdministrativeTasks(
  visitId: string,
  updates: { taskId: string; status: VisitTaskStatus }[],
): Promise<ServiceResult<{ updated: number; skipped: number }>> {
  if (updates.length === 0) return { ok: false, error: 'Keine Aufgabenänderungen übergeben.' };
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Datenbank ist nicht verfügbar.' };
  const { data, error } = await supabase.rpc('admin_bulk_update_assist_visit_tasks' as never, {
    p_visit_id: visitId,
    p_updates: updates.map((update) => ({
      task_id: update.taskId,
      status: update.status,
    })),
    p_reason: AUTOMATIC_ADMIN_AUDIT_REASON,
  } as never);
  if (error) return { ok: false, error: toAdministrativeError(error) };
  const result = data as { updated?: number; skipped?: number } | null;
  return {
    ok: true,
    data: {
      updated: result?.updated ?? updates.length,
      skipped: result?.skipped ?? 0,
    },
  };
}

export function completeAdministrativeFollowUp(
  visitId: string,
  taskStates: { taskId: string; status: VisitTaskStatus }[],
) {
  return runAdministrativeRpc('admin_reconcile_complete_assist_visit_follow_up', {
    p_visit_id: visitId,
    p_task_states: taskStates.map((task) => ({
      task_id: task.taskId,
      status: task.status,
    })),
    p_reason: AUTOMATIC_ADMIN_AUDIT_REASON,
  });
}
