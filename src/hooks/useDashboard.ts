import { useCallback, useEffect, useState } from 'react';
import type { DashboardScope, DashboardSnapshot } from '@/types/dashboard';
import { useAuth } from '@/lib/auth/context';
import { resolveEffectiveRoleKey } from '@/lib/auth/sessionTarget';
import { fetchDashboardSnapshot } from '@/lib/dashboard';
import { useServiceTenantId } from '@/hooks/useTenantId';

export function useDashboard(scope: DashboardScope) {
  const { profile, portalSession, user } = useAuth();
  const tenantId = useServiceTenantId();
  const roleKey = resolveEffectiveRoleKey(profile, user, portalSession);
  const [data, setData] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (simulateError = false) => {
      setLoading(true);
      setError(null);

      if (!tenantId) {
        setData(null);
        setError('Kein Mandant am Profil hinterlegt. Bitte Administrator kontaktieren.');
        setLoading(false);
        return;
      }

      const result = await fetchDashboardSnapshot(
        tenantId,
        roleKey,
        scope,
        {
          simulateError,
          tenantNameHint: portalSession?.tenantName ?? null,
        },
      );

      if (result.ok) {
        setData(result.data);
      } else {
        setData(null);
        setError(result.error);
      }

      setLoading(false);
    },
    [tenantId, roleKey, scope, portalSession?.tenantName],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    data,
    loading,
    error,
    refresh,
    isEmpty: !loading && !error && data !== null && data.activities.length === 0,
  };
}
