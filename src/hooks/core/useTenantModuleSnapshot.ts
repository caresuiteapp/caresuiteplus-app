import { useCallback, useEffect, useState } from 'react';
import type { RoleKey, ServiceResult } from '@/types';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';

export type ModuleSnapshot = {
  wp: number;
  domain: string;
  recordCount: number;
  labels: string[];
};

export function useTenantModuleSnapshot(
  wp: number,
  fetchSnapshot: (
    tenantId: string,
    actorRoleKey?: RoleKey | null,
  ) => Promise<ServiceResult<ModuleSnapshot>>,
) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [data, setData] = useState<ModuleSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (!tenantId) {
      setData(null);
      setError('Kein Mandant am Profil hinterlegt.');
      setLoading(false);
      return;
    }
    const result = await fetchSnapshot(tenantId, profile?.roleKey);
    if (result.ok) setData(result.data);
    else {
      setData(null);
      setError(result.error);
    }
    setLoading(false);
  }, [tenantId, profile?.roleKey, fetchSnapshot]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh, wp };
}
