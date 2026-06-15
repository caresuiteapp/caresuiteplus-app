import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { fetchTIDashboard } from '@/lib/ti';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';

export function useTIDashboard() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  return useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchTIDashboard(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
  { enabled: !!tenantId },
  );
}
