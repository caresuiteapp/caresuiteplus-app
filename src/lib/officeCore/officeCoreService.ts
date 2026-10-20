import type { RoleKey, ServiceResult } from '@/types';
import type { OfficeCoreStats } from '@/lib/officeCore/types';
import { officeCoreDemoRepository } from '@/lib/officeCore/demoRepository';
import { enforcePermission } from '@/lib/permissions';
import { guardLiveDemoFeature } from '@/lib/services/liveServiceGuard';

const LOAD_DELAY_MS = 240;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** OfficeCore — zentrale Plattform-Kennzahlen und Mandantenübersicht. */
export async function fetchOfficeCoreStats(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<OfficeCoreStats>> {
  const denied = enforcePermission<OfficeCoreStats>(actorRoleKey, 'office.access' as never);
  if (denied) return denied;

  const liveBlock = guardLiveDemoFeature<OfficeCoreStats>(tenantId, 'Office-Kennzahlen');
  if (liveBlock) return liveBlock;

  await delay(LOAD_DELAY_MS);
  return { ok: true, data: officeCoreDemoRepository.getStats() };
}
