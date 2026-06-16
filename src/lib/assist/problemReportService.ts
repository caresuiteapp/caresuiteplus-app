import type { RoleKey, ServiceResult } from '@/types';
import type { EmergencyReport, ProblemReport, ProblemReportType } from '@/types/modules/liveMonitor';
import { enforcePermission } from '@/lib/permissions';
import { buildWorkspaceAccessContext, canStartAssignment } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getAssignmentWorkflow } from './assignmentWorkflowService';
import {
  onEmergencyReported,
  onNoShowReported,
  onProblemReported,
} from './managementTaskAutomationService';
import {
  LIVE_MONITOR_STORE,
  filterByTenant,
  nextEmergencyId,
  nextProblemId,
} from './liveMonitorStore';
import { recordLiveOperationEvent } from './liveOperationEventService';
import {
  createMonitorNotification,
  notifyAdmins,
} from './monitorNotificationService';
import { writeMonitorAuditEvent } from './monitorAuditService';
import { handleStatusSideEffects } from './liveMonitorOrchestrator';

export function reportProblem(input: {
  tenantId: string;
  assignmentId: string;
  employeeId: string;
  reportType: ProblemReportType;
  description: string;
  actorRoleKey?: RoleKey | null;
  actorUserId?: string | null;
}): ServiceResult<ProblemReport> {
  const denied = enforcePermission<ProblemReport>(input.actorRoleKey, 'assist.execution.manage');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(input.tenantId);
  if (tenantBlock) return tenantBlock;

  const assignment = getAssignmentWorkflow(input.tenantId, input.assignmentId);
  if (!assignment) return { ok: false, error: 'Einsatz nicht gefunden.' };

  const ctx = buildWorkspaceAccessContext({
    tenantId: input.tenantId,
    roleKey: input.actorRoleKey ?? null,
    userId: input.actorUserId ?? 'demo-user',
    employeeId: input.employeeId,
  });
  const access = canStartAssignment(ctx, {
    tenantId: assignment.tenantId,
    employeeId: assignment.employeeId ?? '',
    clientId: assignment.clientId,
  });
  if (!access.allowed) {
    return { ok: false, error: access.message ?? 'Keine Berechtigung für Problem-Meldung.' };
  }

  const report: ProblemReport = {
    id: nextProblemId(),
    tenantId: input.tenantId,
    assignmentId: input.assignmentId,
    employeeId: input.employeeId,
    reportType: input.reportType,
    description: input.description,
    createdAt: new Date().toISOString(),
  };
  LIVE_MONITOR_STORE.problemReports.push(report);

  const eventType = input.reportType === 'no_show' ? 'no_show_reported' : 'problem_reported';
  recordLiveOperationEvent({
    tenantId: input.tenantId,
    assignmentId: input.assignmentId,
    actorUserId: input.actorUserId ?? null,
    actorRole: input.actorRoleKey ?? null,
    eventType,
    source: 'employee_portal',
    metadata: { reportType: input.reportType },
  });

  writeMonitorAuditEvent({
    tenantId: input.tenantId,
    assignmentId: input.assignmentId,
    clientId: assignment.clientId,
    action: eventType,
    actorUserId: input.actorUserId ?? null,
    actorRole: input.actorRoleKey ?? null,
    afterState: { reportType: input.reportType, description: input.description },
    source: 'employee_portal',
    reason: input.description,
  });

  onProblemReported({
    tenantId: input.tenantId,
    assignmentId: input.assignmentId,
    clientId: assignment.clientId,
    employeeId: input.employeeId,
    description: input.description,
    reportType: input.reportType,
  });

  notifyAdmins(
    input.tenantId,
    input.assignmentId,
    eventType,
    'Problem gemeldet',
    input.description,
    'critical',
  );

  createMonitorNotification({
    tenantId: input.tenantId,
    assignmentId: input.assignmentId,
    recipientType: 'employee',
    recipientId: input.employeeId,
    eventType,
    title: 'Problem erfasst',
    body: 'Ihre Meldung wurde an die Verwaltung weitergeleitet.',
  });

  if (input.reportType === 'no_show') {
    onNoShowReported({
      tenantId: input.tenantId,
      assignmentId: input.assignmentId,
      clientId: assignment.clientId,
      employeeId: input.employeeId,
    });
    handleStatusSideEffects({
      tenantId: input.tenantId,
      assignmentId: input.assignmentId,
      clientId: assignment.clientId,
      employeeId: assignment.employeeId,
      oldStatus: assignment.status,
      newStatus: 'nicht_erschienen',
      actorUserId: input.actorUserId ?? null,
      actorRole: input.actorRoleKey ?? null,
      source: 'employee_portal',
    });
  }

  return { ok: true, data: report };
}

export function reportEmergency(input: {
  tenantId: string;
  assignmentId: string;
  employeeId: string;
  description: string;
  actorRoleKey?: RoleKey | null;
  actorUserId?: string | null;
}): ServiceResult<EmergencyReport> {
  const denied = enforcePermission<EmergencyReport>(input.actorRoleKey, 'assist.execution.manage');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(input.tenantId);
  if (tenantBlock) return tenantBlock;

  const assignment = getAssignmentWorkflow(input.tenantId, input.assignmentId);
  if (!assignment) return { ok: false, error: 'Einsatz nicht gefunden.' };

  const ctx = buildWorkspaceAccessContext({
    tenantId: input.tenantId,
    roleKey: input.actorRoleKey ?? null,
    userId: input.actorUserId ?? 'demo-user',
    employeeId: input.employeeId,
  });
  const access = canStartAssignment(ctx, {
    tenantId: assignment.tenantId,
    employeeId: assignment.employeeId ?? '',
    clientId: assignment.clientId,
  });
  if (!access.allowed) {
    return { ok: false, error: access.message ?? 'Keine Berechtigung für Notfall-Meldung.' };
  }

  const report: EmergencyReport = {
    id: nextEmergencyId(),
    tenantId: input.tenantId,
    assignmentId: input.assignmentId,
    employeeId: input.employeeId,
    description: input.description,
    protocolPrepared: true,
    createdAt: new Date().toISOString(),
  };
  LIVE_MONITOR_STORE.emergencyReports.push(report);

  recordLiveOperationEvent({
    tenantId: input.tenantId,
    assignmentId: input.assignmentId,
    actorUserId: input.actorUserId ?? null,
    actorRole: input.actorRoleKey ?? null,
    eventType: 'emergency_reported',
    source: 'employee_portal',
    metadata: { protocolPrepared: 'true' },
  });

  writeMonitorAuditEvent({
    tenantId: input.tenantId,
    assignmentId: input.assignmentId,
    clientId: assignment.clientId,
    action: 'emergency_reported',
    actorUserId: input.actorUserId ?? null,
    actorRole: input.actorRoleKey ?? null,
    afterState: { description: input.description },
    source: 'employee_portal',
    reason: input.description,
  });

  onEmergencyReported({
    tenantId: input.tenantId,
    assignmentId: input.assignmentId,
    clientId: assignment.clientId,
    employeeId: input.employeeId,
    description: input.description,
  });

  notifyAdmins(
    input.tenantId,
    input.assignmentId,
    'emergency_reported',
    'NOTFALL gemeldet',
    input.description,
    'critical',
  );

  createMonitorNotification({
    tenantId: input.tenantId,
    assignmentId: input.assignmentId,
    recipientType: 'client',
    recipientId: assignment.clientId,
    eventType: 'emergency_reported',
    title: 'Notfall-Meldung',
    body: 'Es wurde ein Notfall im Einsatz gemeldet. Die Verwaltung wurde informiert.',
    priority: 'critical',
  });

  return { ok: true, data: report };
}

export function listProblemReports(tenantId: string, assignmentId?: string): ProblemReport[] {
  if (!tenantId?.trim()) return [];
  return filterByTenant(LIVE_MONITOR_STORE.problemReports, tenantId).filter(
    (r) => !assignmentId || r.assignmentId === assignmentId,
  );
}

export function listEmergencyReports(tenantId: string, assignmentId?: string): EmergencyReport[] {
  if (!tenantId?.trim()) return [];
  return filterByTenant(LIVE_MONITOR_STORE.emergencyReports, tenantId).filter(
    (r) => !assignmentId || r.assignmentId === assignmentId,
  );
}
