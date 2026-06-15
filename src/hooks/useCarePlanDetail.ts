import type { CarePlanDetail } from '@/types/modules/pflege';
import { fetchCarePlanDetail } from '@/lib/pflege';
import { getDemoVitalsForCarePlan } from '@/data/demo/vitalReadings';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from './core';

export function useCarePlanDetail(planId: string | undefined) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const roleKey = profile?.roleKey ?? null;

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      if (!planId) {
        return Promise.resolve({ ok: false as const, error: 'Keine Pflegeplan-ID angegeben.' });
      }
      return fetchCarePlanDetail(planId, tenantId, roleKey);
    },
    [tenantId, planId, roleKey],
    { enabled: Boolean(planId) && !!tenantId },
  );

  const vitals = planId ? getDemoVitalsForCarePlan(planId) : [];

  return {
    data: query.data as CarePlanDetail | undefined,
    vitals,
    loading: query.loading,
    error: query.error,
    refresh: query.refresh,
    notFound: !query.loading && !query.error && !query.data,
  };
}
