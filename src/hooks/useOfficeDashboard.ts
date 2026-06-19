import { useCallback, useEffect, useState } from 'react';
import type { DashboardSnapshot } from '@/types/dashboard';
import { useAuth } from '@/lib/auth/context';
import { fetchOfficeDashboard } from '@/lib/office/officeDashboardService';
import { useServiceTenantId } from '@/hooks/useTenantId';

export function useOfficeDashboard() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [data, setData] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!tenantId) {
      setData(null);
      setError('Kein Mandant am Profil hinterlegt. Bitte Administrator kontaktieren.');
      setLoading(false);
      return;
    }

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
