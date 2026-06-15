import type { RoleKey, ServiceResult } from '@/types';
import type { ModuleDocumentVisibility } from '@/lib/officeCore/types';
import { officeCoreDemoRepository } from '@/lib/officeCore/demoRepository';
import { enforcePermission } from '@/lib/permissions';
import { guardLiveDemoFeature } from '@/lib/services/liveServiceGuard';

export async function fetchModuleDocumentVisibility(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<ModuleDocumentVisibility[]>> {
  const denied = enforcePermission<ModuleDocumentVisibility[]>(actorRoleKey, 'office.access' as never);
  if (denied) return denied;
  const liveBlock = guardLiveDemoFeature<ModuleDocumentVisibility[]>(
    tenantId,
    'Modul-Dokument-Sichtbarkeit',
  );
  if (liveBlock) return liveBlock;
  await new Promise((r) => setTimeout(r, 200));
  return { ok: true, data: officeCoreDemoRepository.listModuleDocumentVisibility() };
}
