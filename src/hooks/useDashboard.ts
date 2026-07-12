import { useCallback, useEffect, useRef, useState } from 'react';
import type { DashboardScope, DashboardSnapshot } from '@/types/dashboard';
import { useAuth } from '@/lib/auth/context';
import { resolveEffectiveRoleKey } from '@/lib/auth/sessionTarget';
import { fetchDashboardSnapshot } from '@/lib/dashboard';
import { subscribeToOfficeDashboardChanges } from '@/lib/realtime';
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import { useServiceTenantId } from '@/hooks/useTenantId';

type RefreshOptions = {
  simulateError?: boolean;
  silent?: boolean;
};

export function useDashboard(scope: DashboardScope) {
  const { profile, portalSession, user } = useAuth();
  const tenantId = useServiceTenantId();
  const roleKey = resolveEffectiveRoleKey(profile, user, portalSession);
  const [data, setData] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const dataRef = useRef<DashboardSnapshot | null>(null);
  const requestInFlightRef = useRef(false);
  dataRef.current = data;

  const refresh = useCallback(
    async (options?: RefreshOptions) => {
      const silent = options?.silent ?? false;
      const hasData = dataRef.current !== null;
      if (requestInFlightRef.current) return;
      requestInFlightRef.current = true;

      if (!silent && !hasData) {
        setLoading(true);
        setError(null);
      }

      if (!tenantId) {
        if (!hasData) {
          setData(null);
          setError('Kein Mandant am Profil hinterlegt. Bitte Administrator kontaktieren.');
        }
        if (!silent && !hasData) {
          setLoading(false);
        }
        requestInFlightRef.current = false;
        return;
      }

      try {
        const result = await withServiceQueryTimeout(
          fetchDashboardSnapshot(
            tenantId,
            roleKey,
            scope,
            {
              simulateError: options?.simulateError,
              tenantNameHint: portalSession?.tenantName ?? null,
            },
          ),
          'Dashboard',
        );

        if (result.ok) {
          setData(result.data);
          setError(null);
        } else if (!hasData) {
          setData(null);
          setError(result.error);
        }
      } catch (cause) {
        if (!hasData) {
          setData(null);
          setError(
            cause instanceof Error ? cause.message : 'Dashboard konnte nicht geladen werden.',
          );
        }
      } finally {
        requestInFlightRef.current = false;
        if (!silent && !hasData) {
          setLoading(false);
        }
      }
    },
    [tenantId, roleKey, scope, portalSession?.tenantName],
  );

  const silentRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh({ silent: true });
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!tenantId || scope !== 'business') {
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
  }, [tenantId, scope, silentRefresh]);

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
