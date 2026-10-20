import type { RoleKey, ServiceResult } from '@/types';
import type { WfmApproval } from '@/types/modules/wfm';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { createWfmApproval, reviewWfmApproval } from './wfmApprovalService';
import { resolveEmployeeIdForUser } from './wfmWorkSessionRepository';

export type WfmCorrectionRequest = {
  sessionId: string;
  eventId?: string | null;
  reason: string;
  proposedOccurredAt?: string | null;
  proposedEventType?: string | null;
};

export async function requestWfmTimeCorrection(
  tenantId: string,
  userId: string,
  actorRoleKey: RoleKey | null,
  input: WfmCorrectionRequest,
  options?: { employeeId?: string | null },
): Promise<ServiceResult<WfmApproval>> {
  const denied = enforcePermission(actorRoleKey, 'time.tracking.own.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (!input.reason.trim()) {
    return { ok: false, error: 'Bitte geben Sie einen Grund für die Korrektur an.' };
  }

  const employeeResult = await resolveEmployeeIdForUser(tenantId, userId, options?.employeeId);
  if (!employeeResult.ok) return employeeResult;

  return createWfmApproval(tenantId, userId, actorRoleKey, {
    employeeId: employeeResult.data,
    approvalType: 'time_correction',
    referenceType: 'workforce_time_event',
    referenceId: input.eventId ?? input.sessionId,
    payload: {
      sessionId: input.sessionId,
      eventId: input.eventId ?? null,
      reason: input.reason,
      proposedOccurredAt: input.proposedOccurredAt ?? null,
      proposedEventType: input.proposedEventType ?? null,
    },
  });
}

export async function reviewWfmTimeCorrection(
  tenantId: string,
  reviewerId: string,
  actorRoleKey: RoleKey | null,
  approvalId: string,
  decision: 'approved' | 'rejected',
  reviewNote?: string,
): Promise<ServiceResult<WfmApproval>> {
  const denied = enforcePermission(actorRoleKey, 'time.tracking.admin.correct');
  if (denied) return denied;

  return reviewWfmApproval(tenantId, reviewerId, actorRoleKey, approvalId, decision, reviewNote);
}

export async function listPendingWfmCorrections(
  tenantId: string,
  actorRoleKey: RoleKey | null,
): Promise<ServiceResult<WfmApproval[]>> {
  const denied = enforcePermission(actorRoleKey, 'time.tracking.admin.correct');
  if (denied) return denied;

  const { listPendingWfmApprovals } = await import('./wfmApprovalService');
  const result = await listPendingWfmApprovals(tenantId, actorRoleKey);
  if (!result.ok) return result;

  return {
    ok: true,
    data: result.data.filter((a) => a.approvalType === 'time_correction'),
  };
}
