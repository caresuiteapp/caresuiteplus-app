import type { FetchReportingDashboardOptions } from '@/lib/reporting/reportingService';
import { fetchReportingDashboard } from '@/lib/reporting';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';

/** Prompt 70 — Hook für Reporting-Dashboard */
export function useReportingDashboard(options: FetchReportingDashboardOptions = {}) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const preset = options.dateRangePreset ?? 'current_month';

  return useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchReportingDashboard(tenantId, profile?.roleKey, {
        ...options,
        dateRangePreset: preset,
      });
    },
    [tenantId, profile?.roleKey, preset, options.dashboardKind],
    { enabled: !!tenantId },
  );
}
