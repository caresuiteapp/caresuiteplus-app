import type { ServiceResult } from '@/types';
import type { RoleKey } from '@/types/core/auth';
import type { DashboardScope, DashboardSnapshot } from '@/types/dashboard';
import { buildDemoDashboard } from '@/data/demo/dashboard';
import { buildLiveDashboardSnapshot } from '@/lib/dashboard/liveDashboardSnapshot';
import { mergeDashboardActivities } from '@/lib/office/officeDashboardMetrics';
import { getServiceMode } from '@/lib/services/mode';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { officeAuditLogSupabaseRepository, DASHBOARD_AUDIT_LIMIT } from '@/lib/services/repositories/officeAuditLogRepository.supabase';
import { officeDashboardSupabaseRepository } from '@/lib/services/repositories/officeDashboardRepository.supabase';
import { fetchClientPortalLiveMetrics } from '@/lib/portal/clientPortalDashboardLive';
import { fetchTenantDisplayName } from '@/lib/tenant/tenantDisplayName';
import { ensureTenantModuleSettingsLoaded } from '@/lib/tenant/tenantModuleSettingsHydration';
import { demoOnlyDelay } from '@/lib/services/demoDelay';

const SIMULATED_DELAY_MS = 400;

async function resolveTenantDisplayName(
  tenantId: string,
  tenantNameHint?: string | null,
): Promise<string> {
  const cached = tenantNameHint?.trim();
  if (cached) return cached;
  return fetchTenantDisplayName(tenantId);
}

export async function fetchDashboardSnapshot(
  tenantId: string,
  roleKey: RoleKey | null,
  scope: DashboardScope,
  options?: { simulateError?: boolean; tenantNameHint?: string | null },
): Promise<ServiceResult<DashboardSnapshot>> {
  try {
    await demoOnlyDelay(SIMULATED_DELAY_MS);

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

      const tenantName = await resolveTenantDisplayName(tenantId, options?.tenantNameHint);

      if (scope === 'business') {
        await ensureTenantModuleSettingsLoaded(tenantId);
        const [metricsResult, auditResult, timelineResult] = await Promise.all([
          officeDashboardSupabaseRepository.fetchBusinessMetrics(tenantId),
          officeAuditLogSupabaseRepository.list(tenantId, DASHBOARD_AUDIT_LIMIT),
          officeDashboardSupabaseRepository.fetchRecentTimelineEvents(tenantId, 12),
        ]);

        const metrics = metricsResult.ok ? metricsResult.data : undefined;
        const auditEntries = auditResult.ok ? auditResult.data : [];
        const timelineEvents = timelineResult.ok ? timelineResult.data : [];
        const activities = mergeDashboardActivities(auditEntries, timelineEvents);

        return {
          ok: true,
          data: buildLiveDashboardSnapshot(
            roleKey,
            scope,
            tenantId,
            tenantName,
            metrics,
            activities,
          ),
        };
      }

      if (scope === 'portal_client' || scope === 'portal_family') {
        const portalMetrics = await fetchClientPortalLiveMetrics(tenantId);
        return {
          ok: true,
          data: buildLiveDashboardSnapshot(
            roleKey,
            scope,
            tenantId,
            tenantName,
            undefined,
            undefined,
            portalMetrics,
          ),
        };
      }

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
