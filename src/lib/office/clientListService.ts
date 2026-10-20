import type { RoleKey, ServiceResult } from '@/types';
import type { ClientListItem } from '@/types/modules/office';
import { clientService, type ClientListOptions } from '@/lib/services';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';

export async function fetchClientList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
  options?: ClientListOptions,
): Promise<ServiceResult<ClientListItem[]>> {
  const denied = enforcePermission<ClientListItem[]>(actorRoleKey, 'office.clients.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  return clientService.list(tenantId, options);
}
