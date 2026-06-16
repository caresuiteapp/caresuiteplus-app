import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import type { CanonicalAssignmentStatus } from '@/types/modules/assignmentWorkflow';
import type {
  LiveEventSource,
  LiveOperationEvent,
  LiveOperationEventType,
} from '@/types/modules/liveMonitor';
import {
  LIVE_MONITOR_STORE,
  filterByTenant,
  nextLiveEventId,
} from './liveMonitorStore';

export function recordLiveOperationEvent(input: {
  tenantId: string;
  assignmentId: string;
  actorUserId?: string | null;
  actorRole?: string | null;
  oldStatus?: AssignmentStatus | CanonicalAssignmentStatus | null;
  newStatus?: AssignmentStatus | CanonicalAssignmentStatus | null;
  eventType: LiveOperationEventType;
  source?: LiveEventSource;
  metadata?: Record<string, string>;
  ipAddress?: string | null;
  deviceId?: string | null;
  locationNote?: string | null;
}): LiveOperationEvent {
  const event: LiveOperationEvent = {
    id: nextLiveEventId(),
    tenantId: input.tenantId,
    assignmentId: input.assignmentId,
    actorUserId: input.actorUserId ?? null,
    actorRole: input.actorRole ?? null,
    oldStatus: input.oldStatus ?? null,
    newStatus: input.newStatus ?? null,
    eventType: input.eventType,
    eventTime: new Date().toISOString(),
    source: input.source ?? 'system',
    metadata: input.metadata ?? {},
    ipAddress: input.ipAddress ?? null,
    deviceId: input.deviceId ?? null,
    locationNote: input.locationNote ?? null,
  };
  LIVE_MONITOR_STORE.liveEvents.push(event);
  return event;
}

export function listLiveOperationEvents(
  tenantId: string,
  assignmentId?: string,
): LiveOperationEvent[] {
  if (!tenantId?.trim()) return [];
  return filterByTenant(LIVE_MONITOR_STORE.liveEvents, tenantId).filter(
    (e) => !assignmentId || e.assignmentId === assignmentId,
  );
}

export function getLatestLiveEvent(tenantId: string, assignmentId: string): LiveOperationEvent | undefined {
  const events = listLiveOperationEvents(tenantId, assignmentId);
  return events[events.length - 1];
}

export function statusToLiveEventType(
  from: AssignmentStatus | null,
  to: AssignmentStatus,
): LiveOperationEventType {
  const map: Partial<Record<AssignmentStatus, LiveOperationEventType>> = {
    unterwegs: 'employee_on_the_way',
    angekommen: 'employee_arrived',
    gestartet: from === 'pausiert' ? 'assignment_resumed' : 'assignment_started',
    pausiert: 'assignment_paused',
    beendet: 'assignment_finished',
    dokumentation_offen: 'documentation_added',
    unterschrift_offen: 'signature_added',
    abgeschlossen: 'assignment_completed',
    nicht_erschienen: 'no_show_reported',
  };
  return map[to] ?? 'assignment_updated';
}

export function canonicalToLiveEventType(status: CanonicalAssignmentStatus): LiveOperationEventType | null {
  const map: Partial<Record<CanonicalAssignmentStatus, LiveOperationEventType>> = {
    cancel_requested: 'assignment_cancel_requested',
    reschedule_requested: 'assignment_reschedule_requested',
  };
  return map[status] ?? null;
}
