import type { RoleKey, ServiceResult } from '@/types';
import type { ClientFormData } from '@/types/forms/clientForm';
import type { ClientDetail } from '@/types/detail';
import { clientService } from '@/lib/services';
import { enforcePermission } from '@/lib/permissions';

export async function createClient(
  tenantId: string,
  form: ClientFormData,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ id: string; detail: ClientDetail }>> {
  const denied = enforcePermission<{ id: string; detail: ClientDetail }>(
    actorRoleKey,
    'office.clients.create',
  );
  if (denied) return denied;
  return clientService.create(tenantId, form);
}
