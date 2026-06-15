import type { RoleKey, ServiceResult } from '@/types';
import { runService } from '@/lib/services/serviceRunner';
import { getDemoMessages, getDemoThreads } from './communication.demoStore';
import { enforceCommunicationPermission } from './communication.permissions';
import type { CommunicationThread, ThreadListFilter } from './communication.types';

export async function findRelatedThreads(
  tenantId: string,
  entityType: 'client' | 'employee' | 'assignment' | 'document' | 'invoice',
  entityId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CommunicationThread[]>> {
  const denied = enforceCommunicationPermission<CommunicationThread[]>(
    actorRoleKey,
    'communication.view_center',
  );
  if (denied) return denied;

  return runService(async () => {
    const keyMap = {
      client: 'clientId',
      employee: 'employeeId',
      assignment: 'assignmentId',
      document: 'documentId',
      invoice: 'invoiceId',
    } as const;

    const field = keyMap[entityType];
    const threads = getDemoThreads().filter((t) => t.tenantId === tenantId && t[field] === entityId);
    return { ok: true, data: threads };
  });
}

export function resolveThreadFilterLabel(filter: ThreadListFilter): string {
  return filter;
}

export function getThreadMessageCount(threadId: string): number {
  return getDemoMessages().filter((m) => m.threadId === threadId).length;
}
