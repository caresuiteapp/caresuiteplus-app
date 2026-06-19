import { useCallback, useEffect, useState } from 'react';
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
  const [isLiveConnected, setIsLiveConnected] = useState(false);

  const refresh = useCallback(async (options?: RefreshOptions) => {
    if (!tenantId) {
      setData(null);
      setError('Kein Mandant am Profil hinterlegt. Bitte Administrator kontaktieren.');
      setLoading(false);
      return;
    }

    if (!options?.silent) {
      setLoading(true);
      setError(null);
    }

    const result = await fetchOfficeDashboard(tenantId, profile?.roleKey ?? null);

    if (result.ok) {
      setData(result.data);
      if (options?.silent) setError(null);
    } else {
      setData(null);
      setError(result.error);
    }

    if (!options?.silent) {
      setLoading(false);
    }
  }, [tenantId, profile?.roleKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!tenantId) {
      setIsLiveConnected(false);
      return;
    }

    const unsubscribe = subscribeToOfficeDashboardChanges(tenantId, () => {
      void refresh({ silent: true });
    });
    setIsLiveConnected(true);
    return () => {
      unsubscribe();
      setIsLiveConnected(false);
    };
  }, [tenantId, refresh]);

  return {
    data,
    loading,
    error,
    refresh,
    isLiveConnected,
    isEmpty: !loading && !error && data !== null && data.activities.length === 0,
  };
}
