import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import type { CanonicalAssignmentStatus } from '@/types/modules/assignmentWorkflow';
import type { LiveEventSource, LiveOperationEventType } from '@/types/modules/liveMonitor';
import { createManagementTask } from './managementTaskService';
import {
  canonicalToLiveEventType,
  recordLiveOperationEvent,
  statusToLiveEventType,
} from './liveOperationEventService';
import {
  notifyAdmins,
  notifyClient,
  notifyEmployee,
} from './monitorNotificationService';
import { writeMonitorAuditEvent } from './monitorAuditService';

export function handleStatusSideEffects(input: {
  tenantId: string;
  assignmentId: string;
  clientId: string;
  employeeId: string | null;
  oldStatus: AssignmentStatus;
  newStatus: AssignmentStatus;
  canonicalStatus?: CanonicalAssignmentStatus;
  actorUserId?: string | null;
  actorRole?: string | null;
  source?: LiveEventSource;
  metadata?: Record<string, string>;
}): void {
  const eventType =
    input.canonicalStatus && canonicalToLiveEventType(input.canonicalStatus)
      ? canonicalToLiveEventType(input.canonicalStatus)!
      : statusToLiveEventType(input.oldStatus, input.newStatus);

  recordLiveOperationEvent({
    tenantId: input.tenantId,
    assignmentId: input.assignmentId,
    actorUserId: input.actorUserId ?? null,
    actorRole: input.actorRole ?? null,
    oldStatus: input.oldStatus,
    newStatus: input.newStatus,
    eventType,
    source: input.source ?? 'system',
    metadata: input.metadata,
  });

  writeMonitorAuditEvent({
    tenantId: input.tenantId,
    assignmentId: input.assignmentId,
    clientId: input.clientId,
    action: eventType,
    actorUserId: input.actorUserId ?? null,
    actorRole: input.actorRole ?? null,
    beforeState: { status: input.oldStatus },
    afterState: { status: input.newStatus },
    source: input.source ?? 'system',
  });

  if (input.canonicalStatus === 'cancel_requested') {
    createManagementTask({
      tenantId: input.tenantId,
      assignmentId: input.assignmentId,
      taskType: 'cancel_review',
      priority: 'high',
    });
    notifyAdmins(input.tenantId, input.assignmentId, 'assignment_cancel_requested', 'Absageanfrage', 'Klient:in hat Absage angefragt.', 'high');
    notifyClient(input.tenantId, input.assignmentId, input.clientId, 'assignment_cancel_requested', 'Absage eingegangen', 'Ihre Absageanfrage wird geprüft.');
    return;
  }

  if (input.canonicalStatus === 'reschedule_requested') {
    createManagementTask({
      tenantId: input.tenantId,
      assignmentId: input.assignmentId,
      taskType: 'reschedule_review',
      priority: 'high',
    });
    notifyAdmins(input.tenantId, input.assignmentId, 'assignment_reschedule_requested', 'Verschiebungsanfrage', 'Klient:in hat Verschiebung angefragt.', 'high');
    notifyClient(input.tenantId, input.assignmentId, input.clientId, 'assignment_reschedule_requested', 'Verschiebung eingegangen', 'Ihre Anfrage wird geprüft.');
    return;
  }

  if (input.newStatus === 'dokumentation_offen') {
    createManagementTask({
      tenantId: input.tenantId,
      assignmentId: input.assignmentId,
      taskType: 'missing_documentation',
    });
    notifyAdmins(input.tenantId, input.assignmentId, 'documentation_added', 'Dokumentation fehlt', 'Einsatz beendet — Dokumentation ausstehend.');
  }

  if (input.newStatus === 'unterschrift_offen') {
    createManagementTask({
      tenantId: input.tenantId,
      assignmentId: input.assignmentId,
      taskType: 'missing_signature',
    });
    notifyAdmins(input.tenantId, input.assignmentId, 'signature_added', 'Unterschrift fehlt', 'Unterschrift ausstehend.');
  }

  if (input.newStatus === 'abgeschlossen') {
    notifyAdmins(input.tenantId, input.assignmentId, 'assignment_completed', 'Einsatz abgeschlossen', 'Einsatz wurde abgeschlossen.');
    if (input.employeeId) {
      notifyEmployee(input.tenantId, input.assignmentId, input.employeeId, 'assignment_completed', 'Einsatz abgeschlossen', 'Ihr Einsatz wurde abgeschlossen.');
    }
    notifyClient(input.tenantId, input.assignmentId, input.clientId, 'assignment_completed', 'Einsatz abgeschlossen', 'Der Einsatz wurde abgeschlossen.');
  }

  if (input.newStatus === 'unterwegs' && input.employeeId) {
    notifyClient(input.tenantId, input.assignmentId, input.clientId, 'employee_on_the_way', 'Mitarbeitende unterwegs', 'Ihre Pflegekraft ist unterwegs.');
  }
}

export function emitWorkflowLiveEvent(input: {
  tenantId: string;
  assignmentId: string;
  clientId: string;
  currentStatus: AssignmentStatus;
  eventType: LiveOperationEventType;
  actorUserId?: string | null;
  actorRole?: string | null;
  source?: LiveEventSource;
  metadata?: Record<string, string>;
}): void {
  recordLiveOperationEvent({
    tenantId: input.tenantId,
    assignmentId: input.assignmentId,
    actorUserId: input.actorUserId ?? null,
    actorRole: input.actorRole ?? null,
    oldStatus: input.currentStatus,
    newStatus: input.currentStatus,
    eventType: input.eventType,
    source: input.source ?? 'administration',
    metadata: input.metadata,
  });

  writeMonitorAuditEvent({
    tenantId: input.tenantId,
    assignmentId: input.assignmentId,
    clientId: input.clientId,
    action: input.eventType,
    actorUserId: input.actorUserId ?? null,
    actorRole: input.actorRole ?? null,
    source: input.source ?? 'administration',
  });
}
