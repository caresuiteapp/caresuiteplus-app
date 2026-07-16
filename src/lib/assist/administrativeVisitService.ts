import type { ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import type { VisitTaskStatus } from './visitTypes';

export type AdministrativeTimes = {
  onTheWayAt?: string | null; arrivedAt?: string | null; startedAt: string; endedAt: string;
  pauseMinutes: number; travelMinutes?: number; reason: string; confirmOverlap?: boolean;
};

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
  if (!input.reason.trim()) return 'Begründung ist erforderlich.';
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
    p_travel_minutes: input.travelMinutes ?? 0, p_reason: input.reason.trim(), p_confirm_overlap: Boolean(input.confirmOverlap),
  } as never);
  if (error) return { ok: false, error: toAdministrativeError(error) };
  const result = data as { ok: boolean; overlap?: boolean; net_minutes?: number };
  if (!result.ok && result.overlap) return { ok: true, data: { overlap: true } };
  return { ok: true, data: { overlap: false, netMinutes: result.net_minutes } };
}

export async function requestClientVisitSignature(_tenantId: string, visit: { id: string; clientId: string; serviceName: string | null; scheduledStart: string; scheduledEnd: string; actualStartAt: string | null; actualEndAt: string | null }, reason: string): Promise<ServiceResult<{ id: string }>> {
  const supabase = getSupabaseClient(); if (!supabase) return { ok: false, error: 'Datenbank ist nicht verfügbar.' };
  if (!reason.trim()) return { ok: false, error: 'Begründung ist erforderlich.' };
  const { data, error } = await supabase.rpc('admin_request_assist_visit_signature' as never, { p_visit_id: visit.id, p_reason: reason.trim() } as never);
  if (error || !data) return { ok: false, error: toAdministrativeError(error) };
  return { ok: true, data: { id: String(data) } };
}

async function runAdministrativeRpc(name: string, params: Record<string, unknown>): Promise<ServiceResult<void>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Datenbank ist nicht verfügbar.' };
  const { error } = await supabase.rpc(name as never, params as never);
  return error ? { ok: false, error: toAdministrativeError(error) } : { ok: true, data: undefined };
}

export function appendAdministrativeDocumentation(visitId: string, content: string, reason: string) {
  if (!content.trim() || !reason.trim()) return Promise.resolve<ServiceResult<void>>({ ok: false, error: 'Dokumentation und Begründung sind erforderlich.' });
  return runAdministrativeRpc('admin_append_assist_visit_documentation', { p_visit_id: visitId, p_content: content.trim(), p_reason: reason.trim() });
}

export function updateAdministrativeTask(visitId: string, taskId: string, status: string, reason: string) {
  if (!reason.trim()) return Promise.resolve<ServiceResult<void>>({ ok: false, error: 'Begründung ist erforderlich.' });
  return runAdministrativeRpc('admin_update_assist_visit_task', { p_visit_id: visitId, p_task_id: taskId, p_status: status, p_reason: reason.trim() });
}

export async function bulkUpdateAdministrativeTasks(
  visitId: string,
  updates: { taskId: string; status: VisitTaskStatus }[],
  reason: string,
): Promise<ServiceResult<{ updated: number }>> {
  if (!reason.trim()) return { ok: false, error: 'Begründung ist erforderlich.' };
  if (updates.length === 0) return { ok: false, error: 'Keine Aufgabenänderungen übergeben.' };
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Datenbank ist nicht verfügbar.' };
  const { data, error } = await supabase.rpc('admin_bulk_update_assist_visit_tasks' as never, {
    p_visit_id: visitId,
    p_updates: updates.map((update) => ({
      task_id: update.taskId,
      status: update.status,
    })),
    p_reason: reason.trim(),
  } as never);
  if (error) return { ok: false, error: toAdministrativeError(error) };
  const result = data as { updated?: number } | null;
  return { ok: true, data: { updated: result?.updated ?? updates.length } };
}

export function completeAdministrativeFollowUp(visitId: string, reason: string) {
  if (!reason.trim()) return Promise.resolve<ServiceResult<void>>({ ok: false, error: 'Begründung ist erforderlich.' });
  return runAdministrativeRpc('admin_complete_assist_visit_follow_up', { p_visit_id: visitId, p_reason: reason.trim() });
}
