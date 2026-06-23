import { getActiveSession, setActiveSession } from './timeTrackingStore';

export type MultiTabStatus = {
  conflict: boolean;
  activeSessionId: string | null;
  message?: string;
};

export function registerActiveSession(
  tenantId: string,
  userId: string,
  sessionId: string,
): MultiTabStatus {
  const existing = getActiveSession(tenantId, userId);
  if (existing && existing !== sessionId) {
    return {
      conflict: true,
      activeSessionId: existing,
      message: 'Arbeitszeit wird bereits in einem anderen Tab erfasst.',
    };
  }
  setActiveSession(tenantId, userId, sessionId);
  return { conflict: false, activeSessionId: sessionId };
}

export function detectMultiTabConflict(
  tenantId: string,
  userId: string,
  localSessionId: string | null,
): MultiTabStatus {
  const remote = getActiveSession(tenantId, userId);
  if (!remote || !localSessionId) {
    return { conflict: false, activeSessionId: remote };
  }
  if (remote !== localSessionId) {
    return {
      conflict: true,
      activeSessionId: remote,
      message: 'Aktive Sitzung in anderem Tab erkannt.',
    };
  }
  return { conflict: false, activeSessionId: remote };
}

export function syncMultiTabHeartbeat(
  tenantId: string,
  userId: string,
  sessionId: string,
): void {
  setActiveSession(tenantId, userId, sessionId);
}
