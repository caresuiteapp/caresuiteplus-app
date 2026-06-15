import type { RoleKey, ServiceResult } from '@/types';
import type { DashboardSnapshot } from '@/types/dashboard';
import { buildOfficeDashboard } from '@/data/demo/officeDashboard';
import { enforcePermission } from '@/lib/permissions';
import { guardLiveDemoFeature } from '@/lib/services/liveServiceGuard';

const LOAD_DELAY_MS = 280;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Office Dashboard — Kennzahlen, Vorgänge und Arbeitsbereiche. */
export async function fetchOfficeDashboard(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<DashboardSnapshot>> {
  const denied = enforcePermission<DashboardSnapshot>(actorRoleKey, 'office.access' as never);
  if (denied) return denied;

  const liveBlock = guardLiveDemoFeature<DashboardSnapshot>(tenantId, 'Office-Dashboard');
  if (liveBlock) return liveBlock;

  await delay(LOAD_DELAY_MS);

  if (!actorRoleKey) {
    return {
      ok: false,
      error: 'Keine Rolle zugewiesen. Dashboard kann nicht geladen werden.',
    };
  }

  return {
    ok: true,
    data: buildOfficeDashboard(actorRoleKey),
  };
}
