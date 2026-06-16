import type { RoleKey, ServiceResult } from '@/types';
import type { DashboardSnapshot } from '@/types/dashboard';
import { buildOfficeDashboard } from '@/data/demo/officeDashboard';
import { buildLiveOfficeDashboardSnapshot } from '@/lib/dashboard/liveDashboardSnapshot';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { fetchTenantDisplayName } from '@/lib/tenant/tenantDisplayName';

const LOAD_DELAY_MS = 280;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resolveTenantDisplayName(tenantId: string): Promise<string> {
  return fetchTenantDisplayName(tenantId);
}

/** Office Dashboard — Kennzahlen, Vorgänge und Arbeitsbereiche. */
export async function fetchOfficeDashboard(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<DashboardSnapshot>> {
  const denied = enforcePermission<DashboardSnapshot>(actorRoleKey, 'office.access' as never);
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  await delay(LOAD_DELAY_MS);

  if (!actorRoleKey) {
    return {
      ok: false,
      error: 'Keine Rolle zugewiesen. Dashboard kann nicht geladen werden.',
    };
  }

  if (getServiceMode() === 'supabase') {
    const tenantName = await resolveTenantDisplayName(tenantId);
    return {
      ok: true,
      data: buildLiveOfficeDashboardSnapshot(actorRoleKey, tenantId, tenantName),
    };
  }

  return {
    ok: true,
    data: buildOfficeDashboard(actorRoleKey),
  };
}
