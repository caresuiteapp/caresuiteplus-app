import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { stationaerDemo } from '@/data/demo/domains/stationaerDemo';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';

export type ResidentDashboardSnapshot = {
  wp: number;
  domain: string;
  activeCount: number;
  draftCount: number;
  highlights: string[];
};

/** WP383 — Resident Dashboard-Service */
export async function fetchResidentDashboard(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<ResidentDashboardSnapshot>> {
  const denied = enforcePermission<ResidentDashboardSnapshot>(actorRoleKey, 'stationaer.residents.view' as never);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  await new Promise((r) => setTimeout(r, 140));
  const records = stationaerDemo.records;
  return {
    ok: true,
    data: {
      wp: 383,
      domain: 'stationaer',
      activeCount: records.filter((r) => r.status === 'aktiv').length,
      draftCount: records.filter((r) => r.status === 'entwurf').length,
      highlights: records.slice(0, 3).map((r) => r.label),
    },
  };
}
