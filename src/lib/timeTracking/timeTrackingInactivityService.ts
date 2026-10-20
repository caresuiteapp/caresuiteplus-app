import type { RoleKey, ServiceResult } from '@/types';
import type {
  InactivityResponseAction,
  TimeInactivityCheck,
  TimeWarning,
} from '@/types/modules/timeTracking';
import { enforcePermission } from '@/lib/permissions';
import { ensureTimeTrackingSettings } from './timeTrackingSettingsService';
import { recordTimeActivityEvent } from './timeTrackingActivityBridge';
import {
  findActiveWorkday,
  listInactivityChecks,
  nextTimeTrackingId,
  saveInactivityCheck,
  saveWarning,
} from './timeTrackingStore';
import { pauseWorkday, switchActivity } from './timeTrackingWorkdayService';

export const INACTIVITY_TRIGGER_MS = 5 * 60 * 1000;
export const INACTIVITY_RESPONSE_MS = 2 * 60 * 1000;

export function shouldTriggerInactivityCheck(
  lastActivityAt: string | null,
  nowMs = Date.now(),
  triggerMinutes = 5,
): boolean {
  if (!lastActivityAt) return false;
  return nowMs - Date.parse(lastActivityAt) >= triggerMinutes * 60 * 1000;
}

export function isInactivityResponseExpired(
  triggeredAt: string,
  nowMs = Date.now(),
  responseMinutes = 2,
): boolean {
  return nowMs - Date.parse(triggeredAt) >= responseMinutes * 60 * 1000;
}

export function triggerInactivityCheck(
  tenantId: string,
  userId: string,
  actorRoleKey: RoleKey | null,
): ServiceResult<TimeInactivityCheck> {
  const denied = enforcePermission(actorRoleKey, 'time.tracking.own.view');
  if (denied) return denied;

  const workday = findActiveWorkday(tenantId, userId);
  if (!workday) {
    return { ok: false, error: 'Kein aktiver Arbeitstag.' };
  }

  const now = new Date().toISOString();
  const check: TimeInactivityCheck = {
    id: nextTimeTrackingId('ic'),
    tenantId,
    workdayId: workday.id,
    userId,
    triggeredAt: now,
    respondedAt: null,
    status: 'pending',
    responseAction: null,
    createdAt: now,
  };
  saveInactivityCheck(check);

  recordTimeActivityEvent({
    tenantId,
    userId,
    workdayId: workday.id,
    eventType: 'inactivity_prompt',
    moduleKey: 'time_tracking',
    resourceId: check.id,
  });

  maybeCreateInactivityWarning(tenantId, userId, workday.id);

  return { ok: true, data: check };
}

function maybeCreateInactivityWarning(tenantId: string, userId: string, workdayId: string): TimeWarning | null {
  const settingsResult = ensureTimeTrackingSettings(tenantId, null);
  const threshold = settingsResult.ok ? settingsResult.data.warningThresholdPerDay : 3;
  const checks = listInactivityChecks(workdayId);

  if (checks.length < threshold) return null;

  const warning: TimeWarning = {
    id: nextTimeTrackingId('warn'),
    tenantId,
    workdayId,
    userId,
    warningType: 'inactivity_threshold',
    message: `Nach ${checks.length} Inaktivitätsprüfungen heute — bitte Tätigkeit prüfen und ggf. zuordnen.`,
    checkCount: checks.length,
    acknowledged: false,
    createdAt: new Date().toISOString(),
  };
  saveWarning(warning);
  return warning;
}

export function respondToInactivityCheck(
  tenantId: string,
  userId: string,
  actorRoleKey: RoleKey | null,
  checkId: string,
  action: InactivityResponseAction,
  switchInput?: { activityTypeId: string },
): ServiceResult<TimeInactivityCheck> {
  const denied = enforcePermission(actorRoleKey, 'time.tracking.own.view');
  if (denied) return denied;

  const checks = listInactivityChecks(findActiveWorkday(tenantId, userId)?.id ?? '');
  const check = checks.find((c) => c.id === checkId);
  if (!check) {
    return { ok: false, error: 'Inaktivitätsprüfung nicht gefunden.' };
  }

  const now = new Date().toISOString();
  const settingsResult = ensureTimeTrackingSettings(tenantId, actorRoleKey);
  const responseMinutes = settingsResult.ok ? settingsResult.data.inactivityResponseMinutes : 2;

  if (isInactivityResponseExpired(check.triggeredAt, Date.now(), responseMinutes) && action !== 'unclear') {
    const timedOut: TimeInactivityCheck = {
      ...check,
      status: 'timed_out',
      respondedAt: now,
      responseAction: action,
    };
    saveInactivityCheck(timedOut);
    return { ok: true, data: timedOut };
  }

  let status: TimeInactivityCheck['status'] = 'responded';
  if (action === 'unclear') {
    status = 'unclear';
    const warning: TimeWarning = {
      id: nextTimeTrackingId('warn'),
      tenantId,
      workdayId: check.workdayId,
      userId,
      warningType: 'unclear_time',
      message: 'Unklare Zeit — bitte Tätigkeit oder Zuordnung ergänzen.',
      checkCount: null,
      acknowledged: false,
      createdAt: now,
    };
    saveWarning(warning);
  }

  const updated: TimeInactivityCheck = {
    ...check,
    status,
    respondedAt: now,
    responseAction: action,
  };
  saveInactivityCheck(updated);

  recordTimeActivityEvent({
    tenantId,
    userId,
    workdayId: check.workdayId,
    eventType: 'inactivity_response',
    moduleKey: 'time_tracking',
    resourceId: check.id,
    metadata: { action },
  });

  if (action === 'pause') {
    pauseWorkday(tenantId, userId, actorRoleKey);
  } else if (action === 'switch' && switchInput?.activityTypeId) {
    switchActivity(tenantId, userId, actorRoleKey, { activityTypeId: switchInput.activityTypeId });
  }

  return { ok: true, data: updated };
}

export function countInactivityChecksToday(workdayId: string): number {
  return listInactivityChecks(workdayId).length;
}

export function shouldShowWarningModal(workdayId: string, threshold = 3): boolean {
  return countInactivityChecksToday(workdayId) >= threshold;
}
