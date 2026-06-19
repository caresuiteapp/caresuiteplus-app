import { useCallback, useEffect, useState } from 'react';
import type { PortalRequest } from '@/types/portal/assist';
import { listTenantPortalRequests } from '@/lib/portal/assist';

export function useTenantPortalRequests(tenantId: string | null, enabled = true) {
  const [requests, setRequests] = useState<PortalRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!tenantId || !enabled) {
      setRequests([]);
      return;
    }
    setLoading(true);
    setError(null);
    const result = await listTenantPortalRequests(tenantId, { limit: 20 });
    if (result.ok) {
      setRequests(result.data);
    } else {
      setError(result.error);
      setRequests([]);
    }
    setLoading(false);
  }, [tenantId, enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { requests, loading, error, refresh };
}
