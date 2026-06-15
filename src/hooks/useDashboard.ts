import { useCallback, useEffect, useState } from 'react';
import type { DashboardScope, DashboardSnapshot } from '@/types/dashboard';
import { useAuth } from '@/lib/auth/context';
import { fetchDashboardSnapshot } from '@/lib/dashboard';

export function useDashboard(scope: DashboardScope) {
  const { profile } = useAuth();
  const [data, setData] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (simulateError = false) => {
      setLoading(true);
      setError(null);

      const result = await fetchDashboardSnapshot(
        profile?.roleKey ?? null,
        scope,
        { simulateError },
      );

      if (result.ok) {
        setData(result.data);
      } else {
        setData(null);
        setError(result.error);
      }

      setLoading(false);
    },
    [profile?.roleKey, scope],
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
