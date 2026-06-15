import type { RoleKey, ServiceResult } from '@/types';
import type { ModulePermissionProfile } from '@/lib/officeCore/types';
import { officeCoreDemoRepository } from '@/lib/officeCore/demoRepository';
import { enforcePermission } from '@/lib/permissions';
import { guardLiveDemoFeature } from '@/lib/services/liveServiceGuard';

export async function fetchModulePermissionProfiles(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<ModulePermissionProfile[]>> {
  const denied = enforcePermission<ModulePermissionProfile[]>(actorRoleKey, 'office.access' as never);
  if (denied) return denied;
  const liveBlock = guardLiveDemoFeature<ModulePermissionProfile[]>(
    tenantId,
    'Modul-Berechtigungsprofile',
  );
  if (liveBlock) return liveBlock;
  await new Promise((r) => setTimeout(r, 200));
  return { ok: true, data: officeCoreDemoRepository.listModulePermissionProfiles() };
}
