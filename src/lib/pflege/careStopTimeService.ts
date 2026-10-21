import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';

export type CareStopTimeKind = 'start' | 'pause' | 'resume' | 'end' | 'correction';
export type CareStopTimeContext = Readonly<{
  stopId: string; tourId: string; clientId: string; stopStatus: string; plannedStart: string; plannedEnd: string;
  expectedStopUpdatedAt: string; state: 'not_started' | 'running' | 'paused' | 'ended';
  events: readonly Readonly<{ id: string; kind: CareStopTimeKind; occurredAt: string; locationContext: Readonly<Record<string, unknown>>; recordedByName: string; correctsEventId: string | null; correctedOccurredAt: string | null; correctionReason: string | null }>[];
}>;

type RpcError = { code?: string; message?: string } | null;
type RpcClient = { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: RpcError }> };
const requestId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

function message(error: RpcError): string {
  if (error?.code === 'PGRST202') return 'Der tatsächliche Einsatzzeitverlauf ist in der Datenbank noch nicht freigeschaltet.';
  if (['23514','40001','P0001'].includes(error?.code ?? '') && error?.message) return error.message;
  return toGermanSupabaseError(error);
}
async function rpc<T>(name: string, args: Record<string, unknown>): Promise<ServiceResult<T>> {
  const client = getSupabaseClient() as unknown as RpcClient | null;
  if (!client) return { ok: false, error: 'Keine Datenbankverbindung.' };
  try { const { data, error } = await client.rpc(name, args); return error || data == null ? { ok: false, error: message(error) } : { ok: true, data: data as T }; }
  catch { return { ok: false, error: 'Verbindung unterbrochen. Zeitverlauf neu laden und gespeicherten Stand prüfen.' }; }
}
function guard<T>(tenantId: string, role?: RoleKey | null): ServiceResult<T> | null {
  const denied = enforcePermission<T>(role, 'pflege.plans.manage'); if (denied) return denied;
  const invalid = guardServiceTenant(tenantId); if (invalid) return invalid as ServiceResult<T>;
  return getServiceMode() === 'supabase' ? null : { ok: false, error: 'Der tatsächliche Einsatzzeitverlauf ist ausschließlich live verfügbar.' };
}
export const fetchCareStopTimeContext = (tenantId: string, role: RoleKey | null | undefined, stopId: string) =>
  guard<CareStopTimeContext>(tenantId, role) ?? rpc<CareStopTimeContext>('get_ambulatory_care_stop_time_context', { p_stop_id: stopId });
export const fetchPortalCareStopTimeContext = (stopId: string) => rpc<CareStopTimeContext>('get_ambulatory_care_stop_time_context', { p_stop_id: stopId });

export function recordCareStopTimeEvent(tenantId: string, role: RoleKey | null | undefined, context: CareStopTimeContext, kind: 'pause' | 'resume' | 'end', locationLabel: string, id = requestId()) {
  const blocked = guard<{ id: string; occurredAt: string; duplicate: boolean }>(tenantId, role); if (blocked) return Promise.resolve(blocked);
  return record(context, kind, locationLabel, id);
}
export const recordPortalCareStopTimeEvent = (context: CareStopTimeContext, kind: 'pause' | 'resume' | 'end', locationLabel: string, id = requestId()) => record(context, kind, locationLabel, id);
function record(context: CareStopTimeContext, kind: 'pause' | 'resume' | 'end', locationLabel: string, id: string) {
  return rpc<{ id: string; occurredAt: string; duplicate: boolean }>('record_ambulatory_care_stop_time_event', {
    p_stop_id: context.stopId, p_event_kind: kind, p_request_id: id,
    p_expected_stop_updated_at: context.expectedStopUpdatedAt,
    p_location_context: { captureMode: 'manual', provided: !!locationLabel.trim(), label: locationLabel.trim() || null },
  });
}
