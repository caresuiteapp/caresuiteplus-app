import type { AssistTimeEventType } from '@/types/assistExecutionPersistence';
import type { ServiceResult } from '@/types';
import type { WfmEventType, WfmSessionStatus, WfmDisplayStatus } from '@/types/modules/wfm';
import {
  fetchTodaySession,
  insertTimeEvent,
  insertWorkSession,
  resolveEmployeeIdForUser,
  todayWorkDate,
  updateWorkSession,
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
  const now = occurredAt ?? new Date().toISOString();
  const workDate = todayWorkDate();

  let sessionResult = await fetchTodaySession(tenantId, empId);
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
      userId,
      workDate,
      status: sessionStatus,
      workMode: 'field',
      displayStatus,
      startedAt: now,
      endedAt: null,
      lastEventAt: now,
      isOnline: true,
    });
    if (!created.ok) return created;
    session = created.data;
  } else {
    const updated = await updateWorkSession(session.id, {
      status: sessionStatus,
      workMode: 'field',
      displayStatus,
      lastEventAt: now,
      isOnline: true,
    });
    if (!updated.ok) return updated;
    session = updated.data;
  }

  const eventResult = await insertTimeEvent({
    id: newUuid(),
    tenantId,
    employeeId: empId,
    userId,
    eventType: wfmEventType,
    workMode: 'field',
    source: 'assist',
    sessionId: session.id,
    note: null,
    occurredAt: now,
  });
  if (!eventResult.ok) return eventResult;

  return { ok: true, data: undefined };
}

export function resetWfmAssistAdapterState(): void {
  /* stateless — demo store reset via resetWfmDemoStore */
}
