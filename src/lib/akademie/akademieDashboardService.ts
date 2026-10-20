import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { akademieDemo } from '@/data/demo/domains/akademieDemo';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';

export type CourseDashboardSnapshot = {
  wp: number;
  domain: string;
  activeCount: number;
  draftCount: number;
  highlights: string[];
};

/** WP423 — Course Dashboard-Service */
export async function fetchCourseDashboard(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CourseDashboardSnapshot>> {
  const denied = enforcePermission<CourseDashboardSnapshot>(actorRoleKey, 'akademie.courses.view' as never);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  await new Promise((r) => setTimeout(r, 140));
  const records = akademieDemo.records;
  return {
    ok: true,
    data: {
      wp: 423,
      domain: 'akademie',
      activeCount: records.filter((r) => r.status === 'aktiv').length,
      draftCount: records.filter((r) => r.status === 'entwurf').length,
      highlights: records.slice(0, 3).map((r) => r.label),
    },
  };
}
