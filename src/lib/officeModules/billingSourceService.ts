import type { RoleKey, ServiceResult } from '@/types';
import type { ModuleBillingSource } from '@/lib/officeCore/types';
import { officeCoreDemoRepository } from '@/lib/officeCore/demoRepository';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { loadModuleBillingSourcesLive } from '@/lib/officeModules/moduleAssignmentLiveLoader';

export async function fetchModuleBillingSources(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<ModuleBillingSource[]>> {
  const denied = enforcePermission<ModuleBillingSource[]>(actorRoleKey, 'office.access' as never);
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    return loadModuleBillingSourcesLive(tenantId);
  }

  await new Promise((r) => setTimeout(r, 200));
  return { ok: true, data: officeCoreDemoRepository.listModuleBillingSources() };
}
