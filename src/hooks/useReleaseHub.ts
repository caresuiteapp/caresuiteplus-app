import { fetchReleaseHub, fetchReleaseList, fetchReleaseDetail } from '@/lib/release';
import { RELEASE_DEMO_TENANT } from '@/data/demo/domains/releaseDemo';
import { useAuth } from '@/lib/auth/context';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';

/** WP528 — Hooks & State Release */
export function useReleaseHub() {
  const { profile } = useAuth();
  return useAsyncQuery(
    () => fetchReleaseHub(RELEASE_DEMO_TENANT, profile?.roleKey),
    [profile?.roleKey],
  );
}

export function useReleaseList() {
  const { profile } = useAuth();
  const query = useAsyncQuery(
    () => fetchReleaseList(RELEASE_DEMO_TENANT, profile?.roleKey),
    [profile?.roleKey],
  );
  return { items: query.data ?? [], loading: query.loading, error: query.error, refresh: query.refresh };
}

export function useReleaseDetail(releaseId: string | undefined) {
  const { profile } = useAuth();
  return useAsyncQuery(
    () =>
      releaseId
        ? fetchReleaseDetail(RELEASE_DEMO_TENANT, releaseId, profile?.roleKey)
        : Promise.resolve({ ok: false as const, error: 'Keine ID' }),
    [releaseId, profile?.roleKey],
  );
}
