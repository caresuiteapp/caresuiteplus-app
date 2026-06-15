import type { RoleKey, ServiceResult } from '@/types';
import type { ClientDetail } from '@/types/detail';
import { clientService, type ClientMutationContext, type ClientUpdateInput } from '@/lib/services';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';

function buildMutationContext(
  actorProfileId?: string | null,
  actorDisplayName?: string | null,
): ClientMutationContext | undefined {
  if (!actorProfileId && !actorDisplayName) return undefined;
  return { actorProfileId, actorDisplayName };
}

export async function fetchClientDetail(
  clientId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<ClientDetail>> {
  const denied = enforcePermission<ClientDetail>(actorRoleKey, 'office.clients.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  return clientService.getById(tenantId, clientId);
}

export async function updateClientStatus(
  clientId: string,
  tenantId: string,
  newStatus: ClientDetail['status'],
  actorRoleKey?: RoleKey | null,
  actorProfileId?: string | null,
  actorDisplayName?: string | null,
): Promise<ServiceResult<ClientDetail>> {
  const denied = enforcePermission<ClientDetail>(actorRoleKey, 'office.clients.status_change');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  return clientService.changeStatus(
    tenantId,
    clientId,
    newStatus,
    buildMutationContext(actorProfileId, actorDisplayName),
  );
}

export async function updateClient(
  clientId: string,
  tenantId: string,
  input: ClientUpdateInput,
  actorRoleKey?: RoleKey | null,
  actorProfileId?: string | null,
  actorDisplayName?: string | null,
): Promise<ServiceResult<ClientDetail>> {
  const denied = enforcePermission<ClientDetail>(actorRoleKey, 'office.clients.edit');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  return clientService.update(
    tenantId,
    clientId,
    input,
    buildMutationContext(actorProfileId, actorDisplayName),
  );
}

export async function archiveClient(
  clientId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
  actorProfileId?: string | null,
  actorDisplayName?: string | null,
): Promise<ServiceResult<ClientDetail>> {
  const denied = enforcePermission<ClientDetail>(actorRoleKey, 'office.clients.archive');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  return clientService.archive(
    tenantId,
    clientId,
    buildMutationContext(actorProfileId, actorDisplayName),
  );
}
