import type { ServiceResult } from '@/types';
import type { WfmWorkTypeKey } from '@/types/modules/wfm';
import {
  fetchTodaySession,
  insertTimeEvent,
  insertWorkSession,
  resolveEmployeeIdForUser,
  todayWorkDate,
  updateWorkSession,
} from './wfmWorkSessionRepository';
import { getWfmWorkType } from './wfmWorkTypes';
import { isWfmSessionActive } from './wfmClockService';

export type HomeofficeWfmAction = 'start' | 'pause' | 'resume' | 'close';

function newUuid(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return '00000000-0000-4000-8000-000000000000'.replace(/0/g, () =>
    Math.floor(Math.random() * 16).toString(16),
  );
}

/**
 * Spiegelt Homeoffice-Arbeitstag (0161) in workforce_* — Legacy Dual-Write.
 * @deprecated UI nutzt WFM direkt; dieser Adapter bleibt für Rückwärtskompatibilität.
 */
export async function syncHomeofficeActionToWfm(
  tenantId: string,
  userId: string,
  action: HomeofficeWfmAction,
  options?: { employeeId?: string | null; workTypeKey?: WfmWorkTypeKey },
): Promise<ServiceResult<void>> {
  const employeeResult = await resolveEmployeeIdForUser(tenantId, userId, options?.employeeId);
  if (!employeeResult.ok) return { ok: true, data: undefined };

  const employeeId = employeeResult.data;
  const now = new Date().toISOString();
  const workDate = todayWorkDate();

  const sessionResult = await fetchTodaySession(tenantId, employeeId);
  if (!sessionResult.ok) return sessionResult;

  if (action === 'start') {
    const workType = getWfmWorkType(options?.workTypeKey ?? 'homeoffice');
    const existing = sessionResult.data;
    if (existing && isWfmSessionActive(existing)) {
      return { ok: true, data: undefined };
    }

    const sessionId = existing?.id ?? newUuid();
    if (existing) {
      await updateWorkSession(existing.id, {
        status: workType.sessionStatus,
        workMode: workType.workMode,
        displayStatus: workType.displayStatus,
        startedAt: now,
        endedAt: null,
        lastEventAt: now,
        isOnline: true,
      });
    } else {
      await insertWorkSession({
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
    }

    await insertTimeEvent({
      id: newUuid(),
      tenantId,
      employeeId,
      userId,
      eventType: 'homeoffice_start',
      workMode: 'homeoffice',
      source: 'system',
      sessionId,
      note: 'Sync aus Homeoffice-Modul',
      occurredAt: now,
    });
    return { ok: true, data: undefined };
  }

  const session = sessionResult.data;
  if (!session) return { ok: true, data: undefined };

  if (action === 'pause') {
    await updateWorkSession(session.id, { status: 'paused', displayStatus: 'pause', lastEventAt: now });
    await insertTimeEvent({
      id: newUuid(),
      tenantId,
      employeeId,
      userId,
      eventType: 'pause_start',
      workMode: 'none',
      source: 'system',
      sessionId: session.id,
      note: 'Sync Homeoffice Pause',
      occurredAt: now,
    });
    return { ok: true, data: undefined };
  }

  if (action === 'resume') {
    await updateWorkSession(session.id, {
      status: 'homeoffice',
      displayStatus: 'homeoffice',
      lastEventAt: now,
    });
    await insertTimeEvent({
      id: newUuid(),
      tenantId,
      employeeId,
      userId,
      eventType: 'pause_end',
      workMode: 'homeoffice',
      source: 'system',
      sessionId: session.id,
      note: 'Sync Homeoffice Fortsetzung',
      occurredAt: now,
    });
    return { ok: true, data: undefined };
  }

  if (action === 'close') {
    const startedAt = session.startedAt ? Date.parse(session.startedAt) : Date.parse(now);
    const grossMinutes = Math.max(0, Math.round((Date.parse(now) - startedAt) / 60000));
    await updateWorkSession(session.id, {
      status: 'ended',
      displayStatus: 'feierabend',
      endedAt: now,
      lastEventAt: now,
      isOnline: false,
      grossMinutes,
      netMinutes: Math.max(0, grossMinutes - session.pauseMinutes),
    });
    await insertTimeEvent({
      id: newUuid(),
      tenantId,
      employeeId,
      userId,
      eventType: 'homeoffice_end',
      workMode: 'homeoffice',
      source: 'system',
      sessionId: session.id,
      note: 'Sync Homeoffice Abschluss',
      occurredAt: now,
    });
    return { ok: true, data: undefined };
  }

  return { ok: true, data: undefined };
}

/** Fire-and-forget Wrapper für HO-Modul-Hooks. */
export function mirrorHomeofficeToWfm(
  tenantId: string,
  userId: string,
  action: HomeofficeWfmAction,
  options?: { employeeId?: string | null },
): void {
  void syncHomeofficeActionToWfm(tenantId, userId, action, options);
}
