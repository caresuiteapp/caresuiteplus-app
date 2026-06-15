import { fetchRoadmapHub, fetchRoadmapList, fetchRoadmapDetail } from '@/lib/roadmap';
import { ROADMAP_DEMO_TENANT } from '@/data/demo/domains/roadmapDemo';
import { useAuth } from '@/lib/auth/context';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';

/** WP588 — Hooks & State Roadmap */
export function useRoadmapHub() {
  const { profile } = useAuth();
  return useAsyncQuery(
    () => fetchRoadmapHub(ROADMAP_DEMO_TENANT, profile?.roleKey),
    [profile?.roleKey],
  );
}

export function useRoadmapList() {
  const { profile } = useAuth();
  const query = useAsyncQuery(
    () => fetchRoadmapList(ROADMAP_DEMO_TENANT, profile?.roleKey),
    [profile?.roleKey],
  );
  return { items: query.data ?? [], loading: query.loading, error: query.error, refresh: query.refresh };
}

export function useRoadmapDetail(itemId: string | undefined) {
  const { profile } = useAuth();
  return useAsyncQuery(
    () =>
      itemId
        ? fetchRoadmapDetail(ROADMAP_DEMO_TENANT, itemId, profile?.roleKey)
        : Promise.resolve({ ok: false as const, error: 'Keine ID' }),
    [itemId, profile?.roleKey],
  );
}
