import type { RoleKey, ServiceResult } from '@/types';
import type { ActiveExecutionItem } from '@/types/modules/assist';
import { fetchActiveExecutions } from './executionService';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';

export async function fetchExecutionList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<ActiveExecutionItem[]>> {
  const denied = enforcePermission<ActiveExecutionItem[]>(
    actorRoleKey,
    'assist.execution.view',
  );
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  return fetchActiveExecutions(tenantId, actorRoleKey);
}
