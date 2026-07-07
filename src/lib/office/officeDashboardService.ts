import type { RoleKey, ServiceResult } from '@/types';
import type { DashboardSnapshot } from '@/types/dashboard';
import { buildOfficeDashboard } from '@/data/demo/officeDashboard';
import { buildLiveOfficeDashboardSnapshot } from '@/lib/dashboard/liveDashboardSnapshot';
import { mergeDashboardActivities } from '@/lib/office/officeDashboardMetrics';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { officeAuditLogSupabaseRepository, DASHBOARD_AUDIT_LIMIT } from '@/lib/services/repositories/officeAuditLogRepository.supabase';
import { officeDashboardSupabaseRepository } from '@/lib/services/repositories/officeDashboardRepository.supabase';
import { fetchTenantDisplayName } from '@/lib/tenant/tenantDisplayName';
import { ensureTenantModuleSettingsLoaded } from '@/lib/tenant/tenantModuleSettingsHydration';
import { demoOnlyDelay } from '@/lib/services/demoDelay';

const LOAD_DELAY_MS = 280;

async function resolveTenantDisplayName(tenantId: string): Promise<string> {
  return fetchTenantDisplayName(tenantId);
}

/** Office Dashboard — Kennzahlen, Vorgänge und Arbeitsbereiche. */
export async function fetchOfficeDashboard(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<DashboardSnapshot>> {
  try {
    const denied = enforcePermission<DashboardSnapshot>(actorRoleKey, 'office.access' as never);
    if (denied) return denied;

    const tenantBlock = guardServiceTenant(tenantId);
    if (tenantBlock) return tenantBlock;

    await demoOnlyDelay(LOAD_DELAY_MS);

    if (!actorRoleKey) {
      return {
        ok: false,
        error: 'Keine Rolle zugewiesen. Dashboard kann nicht geladen werden.',
      };
    }

    if (getServiceMode() === 'supabase') {
      const tenantName = await resolveTenantDisplayName(tenantId);
      await ensureTenantModuleSettingsLoaded(tenantId);
      const [metricsResult, auditResult, timelineResult] = await Promise.all([
        officeDashboardSupabaseRepository.fetchMetrics(tenantId),
        officeAuditLogSupabaseRepository.list(tenantId, DASHBOARD_AUDIT_LIMIT),
        officeDashboardSupabaseRepository.fetchRecentTimelineEvents(tenantId, 12),
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
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Ein unerwarteter Fehler ist aufgetreten.';
    return { ok: false, error: message };
  }
}
