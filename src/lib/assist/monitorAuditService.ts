import type { LiveEventSource, MonitorAuditEvent } from '@/types/modules/liveMonitor';
import {
  LIVE_MONITOR_STORE,
  filterByTenant,
  nextAuditId,
} from './liveMonitorStore';

export function writeMonitorAuditEvent(input: {
  tenantId: string;
  assignmentId: string;
  clientId?: string | null;
  documentId?: string | null;
  action: string;
  actorUserId?: string | null;
  actorRole?: string | null;
  beforeState?: Record<string, string> | null;
  afterState?: Record<string, string> | null;
  source?: LiveEventSource;
  reason?: string | null;
}): MonitorAuditEvent {
  const event: MonitorAuditEvent = {
    id: nextAuditId(),
    tenantId: input.tenantId,
    assignmentId: input.assignmentId,
    clientId: input.clientId ?? null,
    documentId: input.documentId ?? null,
    action: input.action,
    actorUserId: input.actorUserId ?? null,
    actorRole: input.actorRole ?? null,
    beforeState: input.beforeState ?? null,
    afterState: input.afterState ?? null,
    source: input.source ?? 'system',
    reason: input.reason ?? null,
    createdAt: new Date().toISOString(),
  };
  LIVE_MONITOR_STORE.auditEvents.push(event);
  return event;
}

export function listMonitorAuditEvents(
  tenantId: string,
  assignmentId?: string,
): MonitorAuditEvent[] {
  if (!tenantId?.trim()) return [];
  return filterByTenant(LIVE_MONITOR_STORE.auditEvents, tenantId).filter(
    (e) => !assignmentId || e.assignmentId === assignmentId,
  );
}

/** Audit-Ereignisse dürfen nicht gelöscht werden — nur lesen. */
export function deleteMonitorAuditEvent(_id: string): { ok: false; error: string } {
  return { ok: false, error: 'Audit-Ereignisse dürfen nicht gelöscht werden.' };
}
