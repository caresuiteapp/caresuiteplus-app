import { useCallback, useEffect, useState } from 'react';
import type { DashboardSnapshot } from '@/types/dashboard';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { useAuth } from '@/lib/auth/context';
import { fetchOfficeDashboard } from '@/lib/office/officeDashboardService';
import { isDemoMode } from '@/lib/supabase/config';

export function useOfficeDashboard() {
  const { profile } = useAuth();
  const [data, setData] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tenantId = profile?.tenantId ?? (isDemoMode() ? DEMO_TENANT_ID : '');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await fetchOfficeDashboard(tenantId, profile?.roleKey ?? null);

    if (result.ok) {
      setData(result.data);
    } else {
      setData(null);
      setError(result.error);
    }

    setLoading(false);
  }, [tenantId, profile?.roleKey]);

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
