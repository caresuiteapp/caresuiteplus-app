import type { RoleKey, ServiceResult } from '@/types';
import type {
  WfmEventSource,
  WfmTodayStatus,
  WfmWorkSession,
  WfmWorkTypeKey,
} from '@/types/modules/wfm';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getWfmWorkType } from './wfmWorkTypes';
import {
  fetchSessionEvents,
  fetchTodaySession,
  insertTimeEvent,
  insertWorkSession,
  resolveEmployeeIdForUser,
  todayWorkDate,
  updateWorkSession,
} from './wfmWorkSessionRepository';

const DISPLAY_STATUS_LABELS: Record<string, string> = {
  im_einsatz: 'Im Einsatz',
  buero: 'Büro',
  homeoffice: 'Home Office',
  pause: 'Pause',
  unterwegs: 'Unterwegs',
  feierabend: 'Feierabend',
  krank: 'Krank',
  urlaub: 'Urlaub',
  offline: 'Offline',
};

const SESSION_STATUS_LABELS: Record<string, string> = {
  offline: 'Nicht gestartet',
  clocked_in: 'Aktiv',
  paused: 'Pause',
  on_visit: 'Im Einsatz',
  driving: 'Unterwegs',
  homeoffice: 'Home Office',
  office: 'Büro',
  standby: 'Bereitschaft',
  training: 'Fortbildung',
  ended: 'Feierabend',
};

function newUuid(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return '00000000-0000-4000-8000-000000000000'.replace(/0/g, () =>
    Math.floor(Math.random() * 16).toString(16),
  );
}

function workModeToSessionStatus(workMode: WfmWorkSession['workMode']): WfmWorkSession['status'] {
  switch (workMode) {
    case 'office':
      return 'office';
    case 'homeoffice':
      return 'homeoffice';
    case 'field':
      return 'on_visit';
    case 'travel':
      return 'driving';
    case 'standby':
      return 'standby';
    case 'training':
      return 'training';
    default:
      return 'clocked_in';
  }
}

export function formatWfmStatusLabel(session: WfmWorkSession | null): string {
  if (!session) return 'Nicht gestartet';
  if (session.displayStatus && DISPLAY_STATUS_LABELS[session.displayStatus]) {
    return DISPLAY_STATUS_LABELS[session.displayStatus]!;
  }
  return SESSION_STATUS_LABELS[session.status] ?? session.status;
}

export function isWfmSessionActive(session: WfmWorkSession | null): boolean {
  if (!session) return false;
  return !['offline', 'ended'].includes(session.status);
}

export function isWfmSessionPaused(session: WfmWorkSession | null): boolean {
  return session?.status === 'paused';
}

export async function getWfmTodayStatus(
  tenantId: string,
  userId: string,
  actorRoleKey: RoleKey | null,
  options?: { employeeId?: string | null; source?: WfmEventSource },
): Promise<ServiceResult<WfmTodayStatus>> {
  const denied = enforcePermission(actorRoleKey, 'time.tracking.own.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const employeeResult = await resolveEmployeeIdForUser(tenantId, userId, options?.employeeId);
  if (!employeeResult.ok) return employeeResult;

  const sessionResult = await fetchTodaySession(tenantId, employeeResult.data);
  if (!sessionResult.ok) return sessionResult;

  const session = sessionResult.data;
  let events: WfmTodayStatus['events'] = [];
  if (session) {
    const eventsResult = await fetchSessionEvents(tenantId, session.id);
    if (!eventsResult.ok) return eventsResult;
    events = eventsResult.data;
  }

  return {
    ok: true,
    data: {
      session,
      events,
      statusLabel: formatWfmStatusLabel(session),
      blockCount: events.length,
    },
  };
}

export async function wfmClockIn(
  tenantId: string,
  userId: string,
  actorRoleKey: RoleKey | null,
  workTypeKey: WfmWorkTypeKey,
  options?: { employeeId?: string | null; source?: WfmEventSource },
): Promise<ServiceResult<WfmTodayStatus>> {
  const denied = enforcePermission(actorRoleKey, 'time.tracking.own.start');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (workTypeKey === 'pause') {
    return { ok: false, error: 'Pause kann nicht als Arbeitstagsstart gewählt werden.' };
  }

  const employeeResult = await resolveEmployeeIdForUser(tenantId, userId, options?.employeeId);
  if (!employeeResult.ok) return employeeResult;
  const employeeId = employeeResult.data;
  const source = options?.source ?? 'portal';

  const existingResult = await fetchTodaySession(tenantId, employeeId);
  if (!existingResult.ok) return existingResult;
  if (existingResult.data && isWfmSessionActive(existingResult.data)) {
    return { ok: false, error: 'Es läuft bereits ein Arbeitstag. Bitte zuerst pausieren oder abschließen.' };
  }

  const workType = getWfmWorkType(workTypeKey);
  const now = new Date().toISOString();
  const workDate = todayWorkDate();
  const existing = existingResult.data;
  const sessionId = existing?.id ?? newUuid();

  if (existing) {
    const updateResult = await updateWorkSession(existing.id, {
      status: workType.sessionStatus,
      workMode: workType.workMode,
      displayStatus: workType.displayStatus,
      startedAt: now,
      endedAt: null,
      lastEventAt: now,
      isOnline: true,
    });
    if (!updateResult.ok) return updateResult;
  } else {
    const sessionInsert = await insertWorkSession({
      id: sessionId,
      tenantId,
      employeeId,
      userId,
      workDate,
      status: workType.sessionStatus,
      workMode: workType.workMode,
      displayStatus: workType.displayStatus,
      startedAt: now,
      endedAt: null,
      lastEventAt: now,
      isOnline: true,
    });
    if (!sessionInsert.ok) return sessionInsert;
  }

  const eventInsert = await insertTimeEvent({
    id: newUuid(),
    tenantId,
    employeeId,
    userId,
    eventType: workType.startEventType,
    workMode: workType.workMode,
    source,
    sessionId,
    note: null,
    occurredAt: now,
  });
  if (!eventInsert.ok) return eventInsert;

  return getWfmTodayStatus(tenantId, userId, actorRoleKey, { employeeId, source });
}

export async function wfmPause(
  tenantId: string,
  userId: string,
  actorRoleKey: RoleKey | null,
  options?: { employeeId?: string | null; source?: WfmEventSource },
): Promise<ServiceResult<WfmTodayStatus>> {
  const denied = enforcePermission(actorRoleKey, 'time.tracking.own.pause');
  if (denied) return denied;

  const employeeResult = await resolveEmployeeIdForUser(tenantId, userId, options?.employeeId);
  if (!employeeResult.ok) return employeeResult;

  const sessionResult = await fetchTodaySession(tenantId, employeeResult.data);
  if (!sessionResult.ok) return sessionResult;
  const session = sessionResult.data;
  if (!session || !isWfmSessionActive(session) || session.status === 'paused') {
    return { ok: false, error: 'Kein aktiver Arbeitstag zum Pausieren.' };
  }

  const now = new Date().toISOString();
  const source = options?.source ?? 'portal';

  const updateResult = await updateWorkSession(session.id, {
    status: 'paused',
    displayStatus: 'pause',
    lastEventAt: now,
  });
  if (!updateResult.ok) return updateResult;

  const eventResult = await insertTimeEvent({
    id: newUuid(),
    tenantId,
    employeeId: employeeResult.data,
    userId,
    eventType: 'pause_start',
    workMode: 'none',
    source,
    sessionId: session.id,
    note: null,
    occurredAt: now,
  });
  if (!eventResult.ok) return eventResult;

  return getWfmTodayStatus(tenantId, userId, actorRoleKey, {
    employeeId: employeeResult.data,
    source,
  });
}

export async function wfmResume(
  tenantId: string,
  userId: string,
  actorRoleKey: RoleKey | null,
  options?: { employeeId?: string | null; source?: WfmEventSource },
): Promise<ServiceResult<WfmTodayStatus>> {
  const denied = enforcePermission(actorRoleKey, 'time.tracking.own.resume');
  if (denied) return denied;

  const employeeResult = await resolveEmployeeIdForUser(tenantId, userId, options?.employeeId);
  if (!employeeResult.ok) return employeeResult;

  const sessionResult = await fetchTodaySession(tenantId, employeeResult.data);
  if (!sessionResult.ok) return sessionResult;
  const session = sessionResult.data;
  if (!session || session.status !== 'paused') {
    return { ok: false, error: 'Kein pausierter Arbeitstag zum Fortsetzen.' };
  }

  const now = new Date().toISOString();
  const source = options?.source ?? 'portal';
  const updateResult = await updateWorkSession(session.id, {
    status: workModeToSessionStatus(session.workMode),
    displayStatus: session.displayStatus === 'pause' ? 'buero' : session.displayStatus,
    lastEventAt: now,
  });
  if (!updateResult.ok) return updateResult;

  const eventResult = await insertTimeEvent({
    id: newUuid(),
    tenantId,
    employeeId: employeeResult.data,
    userId,
    eventType: 'pause_end',
    workMode: session.workMode,
    source,
    sessionId: session.id,
    note: null,
    occurredAt: now,
  });
  if (!eventResult.ok) return eventResult;

  return getWfmTodayStatus(tenantId, userId, actorRoleKey, {
    employeeId: employeeResult.data,
    source,
  });
}

export async function wfmSwitchWorkType(
  tenantId: string,
  userId: string,
  actorRoleKey: RoleKey | null,
  workTypeKey: WfmWorkTypeKey,
  options?: { employeeId?: string | null; source?: WfmEventSource },
): Promise<ServiceResult<WfmTodayStatus>> {
  const denied = enforcePermission(actorRoleKey, 'time.tracking.own.switch');
  if (denied) return denied;

  const employeeResult = await resolveEmployeeIdForUser(tenantId, userId, options?.employeeId);
  if (!employeeResult.ok) return employeeResult;

  const sessionResult = await fetchTodaySession(tenantId, employeeResult.data);
  if (!sessionResult.ok) return sessionResult;
  const session = sessionResult.data;
  if (!session || !isWfmSessionActive(session)) {
    return { ok: false, error: 'Kein laufender Arbeitstag für Tätigkeitswechsel.' };
  }

  if (workTypeKey === 'pause') {
    return wfmPause(tenantId, userId, actorRoleKey, options);
  }

  const workType = getWfmWorkType(workTypeKey);
  const now = new Date().toISOString();
  const source = options?.source ?? 'portal';

  const updateResult = await updateWorkSession(session.id, {
    status: workType.sessionStatus,
    workMode: workType.workMode,
    displayStatus: workType.displayStatus,
    lastEventAt: now,
  });
  if (!updateResult.ok) return updateResult;

  const eventResult = await insertTimeEvent({
    id: newUuid(),
    tenantId,
    employeeId: employeeResult.data,
    userId,
    eventType: workType.startEventType,
    workMode: workType.workMode,
    source,
    sessionId: session.id,
    note: null,
    occurredAt: now,
  });
  if (!eventResult.ok) return eventResult;

  return getWfmTodayStatus(tenantId, userId, actorRoleKey, {
    employeeId: employeeResult.data,
    source,
  });
}

export async function wfmClockOut(
  tenantId: string,
  userId: string,
  actorRoleKey: RoleKey | null,
  options?: { employeeId?: string | null; source?: WfmEventSource },
): Promise<ServiceResult<WfmTodayStatus>> {
  const denied = enforcePermission(actorRoleKey, 'time.tracking.own.close');
  if (denied) return denied;

  const employeeResult = await resolveEmployeeIdForUser(tenantId, userId, options?.employeeId);
  if (!employeeResult.ok) return employeeResult;

  const sessionResult = await fetchTodaySession(tenantId, employeeResult.data);
  if (!sessionResult.ok) return sessionResult;
  const session = sessionResult.data;
  if (!session || (!isWfmSessionActive(session) && session.status !== 'paused')) {
    return { ok: false, error: 'Kein Arbeitstag zum Abschließen.' };
  }

  const now = new Date().toISOString();
  const source = options?.source ?? 'portal';
  const startedAt = session.startedAt ? Date.parse(session.startedAt) : Date.parse(now);
  const grossMinutes = Math.max(0, Math.round((Date.parse(now) - startedAt) / 60000));

  const updateResult = await updateWorkSession(session.id, {
    status: 'ended',
    displayStatus: 'feierabend',
    endedAt: now,
    lastEventAt: now,
    isOnline: false,
    grossMinutes,
    netMinutes: Math.max(0, grossMinutes - session.pauseMinutes),
  });
  if (!updateResult.ok) return updateResult;

  const eventResult = await insertTimeEvent({
    id: newUuid(),
    tenantId,
    employeeId: employeeResult.data,
    userId,
    eventType: 'clock_out',
    workMode: session.workMode,
    source,
    sessionId: session.id,
    note: null,
    occurredAt: now,
  });
  if (!eventResult.ok) return eventResult;

  return getWfmTodayStatus(tenantId, userId, actorRoleKey, {
    employeeId: employeeResult.data,
    source,
  });
}
