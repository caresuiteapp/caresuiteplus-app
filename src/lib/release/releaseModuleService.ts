import type { RoleKey, ServiceResult } from '@/types';
import { RELEASE_DEMO_TENANT } from '@/data/demo/domains/releaseDemo';
import { releaseDemoList } from '@/data/demo/domains/releaseDemo';
import { enforcePermission } from '@/lib/permissions';

/** WP527 — Release Modul-Service */
export async function fetchReleaseModuleSnapshot(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ wp: number; domain: string; recordCount: number; version: string }>> {
  const denied = enforcePermission<{ wp: number; domain: string; recordCount: number; version: string }>(
    actorRoleKey,
    'release.view',
  );
  if (denied) return denied;
  if (tenantId !== RELEASE_DEMO_TENANT) return { ok: false, error: 'Mandant nicht gefunden.' };
  await new Promise((r) => setTimeout(r, 100));
  return {
    ok: true,
    data: { wp: 527, domain: 'release', recordCount: releaseDemoList.length, version: '1.0.0' },
  };
}
