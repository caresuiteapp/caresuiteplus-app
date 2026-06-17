import type { RoleKey, ServiceResult } from '@/types';
import type { ModulePermissionProfile } from '@/lib/officeCore/types';
import { officeCoreDemoRepository } from '@/lib/officeCore/demoRepository';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { loadModulePermissionProfilesLive } from '@/lib/officeModules/moduleAssignmentLiveLoader';

export async function fetchModulePermissionProfiles(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<ModulePermissionProfile[]>> {
  const denied = enforcePermission<ModulePermissionProfile[]>(actorRoleKey, 'office.access' as never);
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    return loadModulePermissionProfilesLive(tenantId);
  }

  await new Promise((r) => setTimeout(r, 200));
  return { ok: true, data: officeCoreDemoRepository.listModulePermissionProfiles() };
}
