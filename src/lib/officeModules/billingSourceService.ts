import type { RoleKey, ServiceResult } from '@/types';
import type { ModuleBillingSource } from '@/lib/officeCore/types';
import { officeCoreDemoRepository } from '@/lib/officeCore/demoRepository';
import { enforcePermission } from '@/lib/permissions';
import { guardLiveDemoFeature } from '@/lib/services/liveServiceGuard';

export async function fetchModuleBillingSources(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<ModuleBillingSource[]>> {
  const denied = enforcePermission<ModuleBillingSource[]>(actorRoleKey, 'office.access' as never);
  if (denied) return denied;
  const liveBlock = guardLiveDemoFeature<ModuleBillingSource[]>(tenantId, 'Modul-Abrechnungsquellen');
  if (liveBlock) return liveBlock;
  await new Promise((r) => setTimeout(r, 200));
  return { ok: true, data: officeCoreDemoRepository.listModuleBillingSources() };
}
