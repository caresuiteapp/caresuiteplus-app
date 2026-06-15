import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { businessDemo } from '@/data/demo/domains/businessDemo';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';

export type BusinessDashboardSnapshot = {
  wp: number;
  domain: string;
  activeCount: number;
  draftCount: number;
  highlights: string[];
};

/** WP123 — Business Dashboard-Service */
export async function fetchBusinessDashboard(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<BusinessDashboardSnapshot>> {
  const denied = enforcePermission<BusinessDashboardSnapshot>(actorRoleKey, 'dashboard.view' as never);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  await new Promise((r) => setTimeout(r, 140));
  const records = businessDemo.records;
  return {
    ok: true,
    data: {
      wp: 123,
      domain: 'business',
      activeCount: records.filter((r) => r.status === 'aktiv').length,
      draftCount: records.filter((r) => r.status === 'entwurf').length,
      highlights: records.slice(0, 3).map((r) => r.label),
    },
  };
}
