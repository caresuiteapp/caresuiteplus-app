import type { ServiceResult } from '@/types';
import type { RoleKey } from '@/types/core/auth';
import type { DashboardScope, DashboardSnapshot } from '@/types/dashboard';
import { buildDemoDashboard } from '@/data/demo/dashboard';
import { buildLiveDashboardSnapshot } from '@/lib/dashboard/liveDashboardSnapshot';
import { getServiceMode } from '@/lib/services/mode';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { fetchTenantDisplayName } from '@/lib/tenant/tenantDisplayName';

const SIMULATED_DELAY_MS = 400;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resolveTenantDisplayName(tenantId: string): Promise<string> {
  return fetchTenantDisplayName(tenantId);
}

export async function fetchDashboardSnapshot(
  tenantId: string,
  roleKey: RoleKey | null,
  scope: DashboardScope,
  options?: { simulateError?: boolean },
): Promise<ServiceResult<DashboardSnapshot>> {
  try {
    await delay(SIMULATED_DELAY_MS);

    if (options?.simulateError) {
      return {
        ok: false,
        error: 'Dashboard-Daten konnten nicht geladen werden. Bitte erneut versuchen.',
      };
    }

    if (!roleKey) {
      return {
        ok: false,
        error: 'Keine Rolle zugewiesen. Dashboard kann nicht geladen werden.',
      };
    }

    if (getServiceMode() === 'supabase') {
      const tenantBlock = guardServiceTenant(tenantId);
      if (tenantBlock) return tenantBlock;

      const tenantName = await resolveTenantDisplayName(tenantId);
      return {
        ok: true,
        data: buildLiveDashboardSnapshot(roleKey, scope, tenantId, tenantName),
      };
    }

    const data = buildDemoDashboard(roleKey, scope);
    return { ok: true, data };
  } catch {
    return {
      ok: false,
      error: 'Ein unerwarteter Fehler ist aufgetreten.',
    };
  }
}
