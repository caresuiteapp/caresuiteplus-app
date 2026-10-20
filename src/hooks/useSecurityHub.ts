import { fetchSecurityHub, fetchSecurityList, fetchSecurityDetail } from '@/lib/security';
import { SECURITY_DEMO_TENANT } from '@/data/demo/domains/securityDemo';
import { useAuth } from '@/lib/auth/context';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';

/** WP548 — Hooks & State Security */
export function useSecurityHub() {
  const { profile } = useAuth();
  return useAsyncQuery(
    () => fetchSecurityHub(SECURITY_DEMO_TENANT, profile?.roleKey),
    [profile?.roleKey],
  );
}

export function useSecurityList() {
  const { profile } = useAuth();
  const query = useAsyncQuery(
    () => fetchSecurityList(SECURITY_DEMO_TENANT, profile?.roleKey),
    [profile?.roleKey],
  );
  return { items: query.data ?? [], loading: query.loading, error: query.error, refresh: query.refresh };
}

export function useSecurityDetail(itemId: string | undefined) {
  const { profile } = useAuth();
  return useAsyncQuery(
    () =>
      itemId
        ? fetchSecurityDetail(SECURITY_DEMO_TENANT, itemId, profile?.roleKey)
        : Promise.resolve({ ok: false as const, error: 'Keine ID' }),
    [itemId, profile?.roleKey],
  );
}
