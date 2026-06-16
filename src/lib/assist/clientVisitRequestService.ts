import type { RoleKey, ServiceResult } from '@/types';
import type { ClientVisitRequest, ClientVisitRequestType } from '@/types/modules/assignmentWorkflow';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getAssignmentWorkflow, requestVisitChange } from './assignmentWorkflowService';

const REQUESTS = new Map<string, ClientVisitRequest>();
let requestCounter = 0;

export async function createClientVisitRequest(input: {
  tenantId: string;
  assignmentId: string;
  clientId: string;
  requestType: ClientVisitRequestType;
  requestedByProfileId: string;
  reason: string;
  proposedStartAt?: string | null;
  proposedEndAt?: string | null;
  actorRoleKey?: RoleKey | null;
}): Promise<ServiceResult<ClientVisitRequest>> {
  const denied = enforcePermission<ClientVisitRequest>(input.actorRoleKey, 'portal.client.appointments.request_change');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(input.tenantId);
  if (tenantBlock) return tenantBlock;

  const assignment = getAssignmentWorkflow(input.tenantId, input.assignmentId);
  if (!assignment) return { ok: false, error: 'Einsatz nicht gefunden.' };
  if (assignment.clientId !== input.clientId) {
    return { ok: false, error: 'Einsatz gehört nicht zum Klient:innenprofil.' };
  }

  requestCounter += 1;
  const now = new Date().toISOString();
  const request: ClientVisitRequest = {
    id: `cvr-${requestCounter}`,
    tenantId: input.tenantId,
    assignmentId: input.assignmentId,
    clientId: input.clientId,
    requestType: input.requestType,
    status: 'requested',
    requestedByProfileId: input.requestedByProfileId,
    reason: input.reason,
    proposedStartAt: input.proposedStartAt ?? null,
    proposedEndAt: input.proposedEndAt ?? null,
    requestedAt: now,
    createdAt: now,
    resolvedAt: null,
  };

  REQUESTS.set(request.id, request);

  const mark = requestVisitChange(input.tenantId, input.assignmentId, input.requestType);
  if (!mark.ok) return mark;

  return { ok: true, data: request };
}

export function getClientVisitRequest(tenantId: string, requestId: string): ClientVisitRequest | undefined {
  const req = REQUESTS.get(requestId);
  if (!req || req.tenantId !== tenantId) return undefined;
  return req;
}

export function listClientVisitRequests(tenantId: string, assignmentId?: string): ClientVisitRequest[] {
  return [...REQUESTS.values()].filter(
    (r) => r.tenantId === tenantId && (!assignmentId || r.assignmentId === assignmentId),
  );
}

export function resetClientVisitRequestStore(): void {
  REQUESTS.clear();
  requestCounter = 0;
}
