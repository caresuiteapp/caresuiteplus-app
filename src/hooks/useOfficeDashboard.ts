import { useCallback, useEffect, useRef, useState } from 'react';
import type { DashboardSnapshot } from '@/types/dashboard';
import { useAuth } from '@/lib/auth/context';
import { fetchOfficeDashboard } from '@/lib/office/officeDashboardService';
import { subscribeToOfficeDashboardChanges } from '@/lib/realtime';
import { useServiceTenantId } from '@/hooks/useTenantId';

type RefreshOptions = {
  silent?: boolean;
};

export function useOfficeDashboard() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [data, setData] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const dataRef = useRef<DashboardSnapshot | null>(null);
  dataRef.current = data;

  const refresh = useCallback(async (options?: RefreshOptions) => {
    const silent = options?.silent ?? false;
    const hasData = dataRef.current !== null;

    if (!tenantId) {
      if (!hasData) {
        setData(null);
        setError('Kein Mandant am Profil hinterlegt. Bitte Administrator kontaktieren.');
      }
      if (!silent && !hasData) {
        setLoading(false);
      }
      return;
    }

    if (!silent && !hasData) {
      setLoading(true);
      setError(null);
    }

    const result = await fetchOfficeDashboard(tenantId, profile?.roleKey ?? null);

    if (result.ok) {
      setData(result.data);
      setError(null);
    } else if (!hasData) {
      setData(null);
      setError(result.error);
    }

    if (!silent && !hasData) {
      setLoading(false);
    }
  }, [tenantId, profile?.roleKey]);

  const silentRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh({ silent: true });
    setRefreshing(false);
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!tenantId) {
      setIsLiveConnected(false);
      return;
    }

    const unsubscribe = subscribeToOfficeDashboardChanges(tenantId, () => {
      void silentRefresh();
    });
    setIsLiveConnected(true);
    return () => {
      unsubscribe();
      setIsLiveConnected(false);
    };
  }, [tenantId, silentRefresh]);

  return {
    data,
    loading,
    error,
    refresh,
    silentRefresh,
    refreshing,
    isLiveConnected,
    isEmpty: !loading && !error && data !== null && data.activities.length === 0,
  };
}
