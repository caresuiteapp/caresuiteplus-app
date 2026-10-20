import type { RoleKey, ServiceResult } from '@/types';
import { runService } from '@/lib/services/serviceRunner';
import {
  appendDemoAssignment,
  getDemoAssignments,
  getDemoThreads,
} from './communication.demoStore';
import { appendCommunicationAudit } from './communication.audit';
import { enforceCommunicationPermission } from './communication.permissions';
import type {
  MessageAssignment,
  MessageAssignmentStatus,
  MessageAssignmentTargetType,
} from './communication.types';

export type AssignmentSuggestion = {
  targetType: MessageAssignmentTargetType;
  targetId: string;
  label: string;
  confidence: number;
};

export async function suggestAssignments(
  tenantId: string,
  threadId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<AssignmentSuggestion[]>> {
  const denied = enforceCommunicationPermission<AssignmentSuggestion[]>(
    actorRoleKey,
    'communication.assign_thread',
  );
  if (denied) return denied;

  return runService(async () => {
    const thread = getDemoThreads().find((t) => t.id === threadId && t.tenantId === tenantId);
    if (!thread) return { ok: false, error: 'Thread nicht gefunden.' };

    const suggestions: AssignmentSuggestion[] = [];
    if (thread.clientId) {
      suggestions.push({
        targetType: 'client',
        targetId: thread.clientId,
        label: `Klient:in ${thread.title}`,
        confidence: 0.92,
      });
    }
    if (thread.employeeId) {
      suggestions.push({
        targetType: 'employee',
        targetId: thread.employeeId,
        label: `Mitarbeiter:in ${thread.title}`,
        confidence: 0.88,
      });
    }
    if (thread.assignmentId) {
      suggestions.push({
        targetType: 'assignment',
        targetId: thread.assignmentId,
        label: 'Einsatz zuordnen',
        confidence: 0.75,
      });
    }
    if (thread.invoiceId) {
      suggestions.push({
        targetType: 'invoice',
        targetId: thread.invoiceId,
        label: 'Rechnung zuordnen',
        confidence: 0.7,
      });
    }

    return { ok: true, data: suggestions };
  });
}

export async function assignThread(
  tenantId: string,
  threadId: string,
  targetType: MessageAssignmentTargetType,
  targetId: string,
  actorRoleKey?: RoleKey | null,
  assignedBy?: string | null,
): Promise<ServiceResult<MessageAssignment>> {
  const denied = enforceCommunicationPermission<MessageAssignment>(
    actorRoleKey,
    'communication.assign_thread',
  );
  if (denied) return denied;

  const now = new Date().toISOString();
  const assignment: MessageAssignment = {
    id: `assign-${Date.now()}`,
    tenantId,
    threadId,
    messageId: null,
    targetType,
    targetId,
    suggestedTargetId: targetId,
    suggestionConfidence: 1,
    status: 'assigned',
    assignedBy: assignedBy ?? null,
    assignedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  appendDemoAssignment(assignment);
  appendCommunicationAudit({
    tenantId,
    userId: assignedBy ?? null,
    action: 'message_assigned',
    entityType: 'communication_assignment',
    entityId: assignment.id,
    threadId,
    result: 'success',
    metadata: { targetType, targetId },
  });

  return { ok: true, data: assignment };
}

export async function assignMessage(
  tenantId: string,
  threadId: string,
  messageId: string,
  targetType: MessageAssignmentTargetType,
  targetId: string,
  actorRoleKey?: RoleKey | null,
  assignedBy?: string | null,
): Promise<ServiceResult<MessageAssignment>> {
  const result = await assignThread(tenantId, threadId, targetType, targetId, actorRoleKey, assignedBy);
  if (!result.ok) return result;
  result.data.messageId = messageId;
  return result;
}

export async function removeAssignment(
  assignmentId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ removed: true }>> {
  const denied = enforceCommunicationPermission<{ removed: true }>(
    actorRoleKey,
    'communication.assign_thread',
  );
  if (denied) return denied;

  const index = getDemoAssignments().findIndex((a) => a.id === assignmentId);
  if (index < 0) return { ok: false, error: 'Zuordnung nicht gefunden.' };
  getDemoAssignments().splice(index, 1);
  return { ok: true, data: { removed: true } };
}

export async function listOpenAssignments(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<MessageAssignment[]>> {
  const denied = enforceCommunicationPermission<MessageAssignment[]>(
    actorRoleKey,
    'communication.assign_thread',
  );
  if (denied) return denied;

  const openStatuses: MessageAssignmentStatus[] = ['open', 'in_review', 'needs_clarification'];
  return {
    ok: true,
    data: getDemoAssignments().filter(
      (a) => a.tenantId === tenantId && openStatuses.includes(a.status),
    ),
  };
}

export async function updateAssignmentStatus(
  assignmentId: string,
  status: MessageAssignmentStatus,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<MessageAssignment>> {
  const denied = enforceCommunicationPermission<MessageAssignment>(
    actorRoleKey,
    'communication.assign_thread',
  );
  if (denied) return denied;

  const assignment = getDemoAssignments().find((a) => a.id === assignmentId);
  if (!assignment) return { ok: false, error: 'Zuordnung nicht gefunden.' };
  assignment.status = status;
  assignment.updatedAt = new Date().toISOString();
  return { ok: true, data: assignment };
}
