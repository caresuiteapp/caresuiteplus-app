import type { AssistTimeEventType } from '@/types/assistExecutionPersistence';
import type { ServiceResult } from '@/types';
import type { WfmEventType, WfmSessionStatus, WfmDisplayStatus } from '@/types/modules/wfm';
import { fetchTimeEventsForVisit } from '@/lib/assist/assistTrackingPersistenceService';
import { calculateVisitTimes } from '@/features/assistWorkflow/calculateVisitTimes';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import {
  fetchSessionForDate,
  hasAssistWfmEvent,
  insertTimeEvent,
  insertWorkSession,
  resolveAuthUserIdForWfmSession,
  resolveEmployeeIdForUser,
  updateWorkSession,
  workDateFromIso,
} from './wfmWorkSessionRepository';

const ASSIST_TO_WFM: Record<AssistTimeEventType, WfmEventType | null> = {
  drive_start: 'visit_drive_start',
  drive_end: 'travel_end',
  service_start: 'visit_started',
  service_end: 'visit_ended',
  pause_start: 'pause_start',
  pause_end: 'pause_end',
  arrive: 'visit_arrived',
  depart: 'visit_ended',
};

const ASSIST_SESSION_STATUS: Partial<Record<AssistTimeEventType, WfmSessionStatus>> = {
  drive_start: 'driving',
  arrive: 'on_visit',
  service_start: 'on_visit',
  pause_start: 'paused',
  pause_end: 'on_visit',
  service_end: 'clocked_in',
  depart: 'clocked_in',
  drive_end: 'clocked_in',
};

const ASSIST_DISPLAY_STATUS: Partial<Record<AssistTimeEventType, WfmDisplayStatus>> = {
  drive_start: 'unterwegs',
  arrive: 'im_einsatz',
  service_start: 'im_einsatz',
  pause_start: 'pause',
  pause_end: 'im_einsatz',
  service_end: 'buero',
  depart: 'buero',
  drive_end: 'buero',
};

function newUuid(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return '00000000-0000-4000-8000-000000000000'.replace(/0/g, () =>
    Math.floor(Math.random() * 16).toString(16),
  );
}

function serviceMinutesFromEvents(
  events: Array<{ eventType: string; occurredAt: string }>,
): { grossMinutes: number; netMinutes: number; pauseMinutes: number } {
  const times = calculateVisitTimes(events, 'beendet');
  const serviceSeconds = times.serviceSeconds ?? 0;
  const pauseSeconds = times.pauseSeconds ?? 0;
  const grossMinutes = Math.max(1, Math.ceil(serviceSeconds / 60));
  const pauseMinutes = pauseSeconds > 0 ? Math.ceil(pauseSeconds / 60) : 0;
  return {
    grossMinutes,
    netMinutes: Math.max(0, grossMinutes - pauseMinutes),
    pauseMinutes,
  };
}

export function mapAssistEventToWfm(eventType: AssistTimeEventType): WfmEventType | null {
  return ASSIST_TO_WFM[eventType] ?? null;
}

/** Spiegelt Assist-Zeitstempel in workforce_time_events + Session-Status. */
export async function syncAssistTimeEventToWfm(
  tenantId: string,
  employeeId: string | null,
  userId: string | null,
  visitId: string,
  assistEventType: AssistTimeEventType,
  occurredAt?: string,
): Promise<ServiceResult<void>> {
  const wfmEventType = mapAssistEventToWfm(assistEventType);
  if (!wfmEventType) return { ok: true, data: undefined };

  const resolvedEmployee = employeeId
    ? { ok: true as const, data: employeeId }
    : userId
      ? await resolveEmployeeIdForUser(tenantId, userId, null)
      : { ok: false as const, error: 'Kein Mitarbeiter für Assist-Sync.' };

  if (!resolvedEmployee.ok) return resolvedEmployee;

  const empId = resolvedEmployee.data;
  const authUserId = await resolveAuthUserIdForWfmSession(tenantId, empId, userId);
  const now = occurredAt ?? new Date().toISOString();
  const workDate = workDateFromIso(now);

  if (await hasAssistWfmEvent(tenantId, empId, wfmEventType, visitId)) {
    if (assistEventType === 'service_end') {
      return applyAssistServiceEndToWfmSession(tenantId, empId, visitId, workDate);
    }
    return { ok: true, data: undefined };
  }

  let sessionResult = await fetchSessionForDate(tenantId, empId, workDate);
  if (!sessionResult.ok) return sessionResult;

  let session = sessionResult.data;
  const sessionStatus = ASSIST_SESSION_STATUS[assistEventType] ?? 'on_visit';
  const displayStatus = ASSIST_DISPLAY_STATUS[assistEventType] ?? 'im_einsatz';

  if (!session) {
    const sessionId = newUuid();
    const created = await insertWorkSession({
      id: sessionId,
      tenantId,
      employeeId: empId,
      userId: authUserId,
      workDate,
      status: sessionStatus,
      workMode: 'field',
      displayStatus,
      startedAt: now,
      endedAt: null,
      lastEventAt: now,
      isOnline: assistEventType !== 'service_end' && assistEventType !== 'depart',
      currentVisitId: visitId,
    });
    if (!created.ok) return created;
    session = created.data;
  } else {
    const updated = await updateWorkSession(session.id, {
      status: sessionStatus,
      workMode: 'field',
      displayStatus,
      lastEventAt: now,
      isOnline: assistEventType !== 'service_end' && assistEventType !== 'depart',
    });
    if (!updated.ok) return updated;
    session = updated.data;
  }

  const eventResult = await insertTimeEvent({
    id: newUuid(),
    tenantId,
    employeeId: empId,
    userId: authUserId,
    eventType: wfmEventType,
    workMode: 'field',
    source: 'assist',
    sessionId: session.id,
    note: null,
    occurredAt: now,
    referenceType: 'visit',
    referenceId: visitId,
  });
  if (!eventResult.ok) return eventResult;

  if (assistEventType === 'service_end') {
    return applyAssistServiceEndToWfmSession(tenantId, empId, visitId, workDate);
  }

  return { ok: true, data: undefined };
}

/** Aktualisiert Session-Minuten nach service_end aus assist_time_events. */
export async function applyAssistServiceEndToWfmSession(
  tenantId: string,
  employeeId: string,
  visitId: string,
  workDate?: string,
): Promise<ServiceResult<void>> {
  const eventsResult = await fetchTimeEventsForVisit(tenantId, visitId, 50);
  if (!eventsResult.ok) return { ok: false, error: eventsResult.error };

  const serviceEnd = eventsResult.data.find((e) => e.eventType === 'service_end');
  const resolvedWorkDate = workDate ?? (serviceEnd ? workDateFromIso(serviceEnd.occurredAt) : workDateFromIso(new Date().toISOString()));

  const sessionResult = await fetchSessionForDate(tenantId, employeeId, resolvedWorkDate);
  if (!sessionResult.ok) return sessionResult;
  if (!sessionResult.data) return { ok: true, data: undefined };

  const minutes = serviceMinutesFromEvents(eventsResult.data);
  const updated = await updateWorkSession(sessionResult.data.id, {
    grossMinutes: minutes.grossMinutes,
    netMinutes: minutes.netMinutes,
    pauseMinutes: minutes.pauseMinutes,
    isOnline: false,
    status: 'clocked_in',
    displayStatus: 'buero',
    lastEventAt: serviceEnd?.occurredAt ?? sessionResult.data.lastEventAt,
  });
  if (!updated.ok) return updated;

  return { ok: true, data: undefined };
}

async function syncAssistVisitTimesToWfmViaRpc(
  tenantId: string,
  visitId: string,
): Promise<ServiceResult<number>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

  const { data, error } = await supabase.rpc('sync_assist_visit_times_to_wfm', {
    p_tenant_id: tenantId,
    p_visit_id: visitId,
  });

  if (error) {
    const message = toGermanSupabaseError(error);
    if (/function.*does not exist|42883/i.test(message)) {
      return { ok: false, error: 'WFM-Sync-RPC fehlt — Migration 0224 anwenden.' };
    }
    return { ok: false, error: message };
  }

  return { ok: true, data: typeof data === 'number' ? data : Number(data ?? 0) };
}

/** Backfill: alle Assist-Events eines Besuchs in WFM spiegeln (idempotent). */
export async function syncAssistVisitTimesToWfm(
  tenantId: string,
  employeeId: string,
  userId: string | null,
  visitId: string,
): Promise<ServiceResult<void>> {
  const rpcSync = await syncAssistVisitTimesToWfmViaRpc(tenantId, visitId);
  if (rpcSync.ok) return { ok: true, data: undefined };
  if (!/Migration 0224/i.test(rpcSync.error ?? '')) {
    return { ok: false, error: rpcSync.error };
  }

  const eventsResult = await fetchTimeEventsForVisit(tenantId, visitId, 50);
  if (!eventsResult.ok) return { ok: false, error: eventsResult.error };

  const syncOrder: AssistTimeEventType[] = [
    'drive_start',
    'drive_end',
    'arrive',
    'service_start',
    'pause_start',
    'pause_end',
    'service_end',
    'depart',
  ];

  const present = new Set(eventsResult.data.map((e) => e.eventType));
  for (const eventType of syncOrder) {
    if (!present.has(eventType)) continue;
    const row = eventsResult.data.find((e) => e.eventType === eventType);
    if (!row) continue;
    const synced = await syncAssistTimeEventToWfm(
      tenantId,
      employeeId,
      userId,
      visitId,
      eventType as AssistTimeEventType,
      row.occurredAt,
    );
    if (!synced.ok) return synced;
  }

  return { ok: true, data: undefined };
}

export function resetWfmAssistAdapterState(): void {
  /* stateless — demo store reset via resetWfmDemoStore */
}
