import type { RoleKey, ServiceResult } from '@/types';
import type { DashboardSnapshot } from '@/types/dashboard';
import { fetchOfficeDashboard } from '@/lib/office/officeDashboardService';

const SNAPSHOT_TTL_MS = 15_000;

type CacheEntry = {
  snapshot: DashboardSnapshot;
  fetchedAt: number;
};

const snapshotCache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<ServiceResult<DashboardSnapshot>>>();

function cacheKey(tenantId: string, roleKey: RoleKey | null): string {
  return `${tenantId}:${roleKey ?? 'none'}`;
}

export function peekOfficeDashboardCache(
  tenantId: string,
  roleKey: RoleKey | null,
): DashboardSnapshot | null {
  const entry = snapshotCache.get(cacheKey(tenantId, roleKey));
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > SNAPSHOT_TTL_MS) return null;
  return entry.snapshot;
}

export function fetchOfficeDashboardCached(
  tenantId: string,
  roleKey: RoleKey | null,
  options?: { force?: boolean },
): Promise<ServiceResult<DashboardSnapshot>> {
  const key = cacheKey(tenantId, roleKey);

  if (!options?.force) {
    const cached = peekOfficeDashboardCache(tenantId, roleKey);
    if (cached) {
      return Promise.resolve({ ok: true, data: cached });
    }
  }

  const pending = inflight.get(key);
  if (pending) return pending;

  const promise = fetchOfficeDashboard(tenantId, roleKey)
    .then((result) => {
      if (result.ok) {
        snapshotCache.set(key, { snapshot: result.data, fetchedAt: Date.now() });
      }
      return result;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}

export function invalidateOfficeDashboardCache(tenantId?: string): void {
  if (!tenantId) {
    snapshotCache.clear();
    inflight.clear();
    return;
  }

  for (const key of snapshotCache.keys()) {
    if (key.startsWith(`${tenantId}:`)) snapshotCache.delete(key);
  }
  for (const key of inflight.keys()) {
    if (key.startsWith(`${tenantId}:`)) inflight.delete(key);
  }
}
