import type { RoleKey, ServiceResult } from '@/types';
import type { DashboardSnapshot } from '@/types/dashboard';
import { buildOfficeDashboard } from '@/data/demo/officeDashboard';
import { buildLiveOfficeDashboardSnapshot } from '@/lib/dashboard/liveDashboardSnapshot';
import { mergeDashboardActivities } from '@/lib/office/officeDashboardMetrics';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { officeAuditLogSupabaseRepository } from '@/lib/services/repositories/officeAuditLogRepository.supabase';
import { officeDashboardSupabaseRepository } from '@/lib/services/repositories/officeDashboardRepository.supabase';
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
    const [metricsResult, auditResult, timelineResult] = await Promise.all([
      officeDashboardSupabaseRepository.fetchMetrics(tenantId),
      officeAuditLogSupabaseRepository.list(tenantId),
      officeDashboardSupabaseRepository.fetchRecentTimelineEvents(tenantId),
    ]);

    const metrics = metricsResult.ok ? metricsResult.data : undefined;
    const auditEntries = auditResult.ok ? auditResult.data : [];
    const timelineEvents = timelineResult.ok ? timelineResult.data : [];
    const activities = mergeDashboardActivities(auditEntries, timelineEvents);

    return {
      ok: true,
      data: buildLiveOfficeDashboardSnapshot(
        actorRoleKey,
        tenantId,
        tenantName,
        metrics,
        activities,
      ),
    };
  }

  return {
    ok: true,
    data: buildOfficeDashboard(actorRoleKey),
  };
}
