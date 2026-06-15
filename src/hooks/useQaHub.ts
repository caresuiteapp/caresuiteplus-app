import { fetchQaHub, fetchQaList, fetchQaDetail } from '@/lib/qa';
import { QA_DEMO_TENANT } from '@/data/demo/domains/qaDemo';
import { useAuth } from '@/lib/auth/context';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';

/** WP568 — Hooks & State QA */
export function useQaHub() {
  const { profile } = useAuth();
  return useAsyncQuery(
    () => fetchQaHub(QA_DEMO_TENANT, profile?.roleKey),
    [profile?.roleKey],
  );
}

export function useQaList() {
  const { profile } = useAuth();
  const query = useAsyncQuery(
    () => fetchQaList(QA_DEMO_TENANT, profile?.roleKey),
    [profile?.roleKey],
  );
  return { items: query.data ?? [], loading: query.loading, error: query.error, refresh: query.refresh };
}

export function useQaDetail(itemId: string | undefined) {
  const { profile } = useAuth();
  return useAsyncQuery(
    () =>
      itemId
        ? fetchQaDetail(QA_DEMO_TENANT, itemId, profile?.roleKey)
        : Promise.resolve({ ok: false as const, error: 'Keine ID' }),
    [itemId, profile?.roleKey],
  );
}
