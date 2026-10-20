import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { beratungDemo } from '@/data/demo/domains/beratungDemo';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';

export type CaseDashboardSnapshot = {
  wp: number;
  domain: string;
  activeCount: number;
  draftCount: number;
  highlights: string[];
};

/** WP403 — Case Dashboard-Service */
export async function fetchCaseDashboard(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CaseDashboardSnapshot>> {
  const denied = enforcePermission<CaseDashboardSnapshot>(actorRoleKey, 'beratung.cases.view' as never);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  await new Promise((r) => setTimeout(r, 140));
  const records = beratungDemo.records;
  return {
    ok: true,
    data: {
      wp: 403,
      domain: 'beratung',
      activeCount: records.filter((r) => r.status === 'aktiv').length,
      draftCount: records.filter((r) => r.status === 'entwurf').length,
      highlights: records.slice(0, 3).map((r) => r.label),
    },
  };
}
