import { fetchPdlCockpit } from '@/lib/reporting';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';

/** WP508 — Hooks & State PDL-Cockpit */
export function usePdlCockpit() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  return useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchPdlCockpit(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );
}
