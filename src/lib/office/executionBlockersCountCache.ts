import { countAssistExecutionProblems } from '@/lib/assist/assistExecutionProblemInboxService';

const CACHE_TTL_MS = 120_000;

type CacheEntry = {
  count: number;
  fetchedAt: number;
};

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<number>>();

/** Non-blocking execution-blocker count for dashboard KPIs (expensive full scan runs in background). */
export function resolveExecutionBlockersCount(tenantId: string): number {
  const entry = cache.get(tenantId);
  if (entry && Date.now() - entry.fetchedAt < CACHE_TTL_MS) {
    return entry.count;
  }

  if (!inflight.has(tenantId)) {
    const promise = countAssistExecutionProblems(tenantId)
      .then((count) => {
        cache.set(tenantId, { count, fetchedAt: Date.now() });
        return count;
      })
      .catch(() => 0)
      .finally(() => {
        inflight.delete(tenantId);
      });
    inflight.set(tenantId, promise);
  }

  return entry?.count ?? 0;
}

export function subscribeExecutionBlockersRefresh(
  tenantId: string,
  onUpdate: (count: number) => void,
): () => void {
  const pending = inflight.get(tenantId);
  if (!pending) return () => undefined;

  let cancelled = false;
  void pending.then((count) => {
    if (!cancelled) onUpdate(count);
  });

  return () => {
    cancelled = true;
  };
}

export function resetExecutionBlockersCountCache(tenantId?: string): void {
  if (tenantId) {
    cache.delete(tenantId);
    inflight.delete(tenantId);
    return;
  }
  cache.clear();
  inflight.clear();
}
