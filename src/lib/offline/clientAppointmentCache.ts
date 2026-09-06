import type { PortalClientAppointmentDetail } from '@/types/portal/client';
import type { RoleKey } from '@/types';
import { getStoreRecord, putStoreRecord, offlineCacheEpoch } from './idb';

export type ClientAppointmentCacheScope = {
  tenantId: string;
  accountId: string;
  clientId: string;
  roleKey: RoleKey | null;
};
type CacheRecord = {
  key: string;
  schema: 1;
  scope: ClientAppointmentCacheScope;
  cachedAt: string;
  payload: PortalClientAppointmentDetail;
};
const MAX_AGE_MS = 7 * 86400_000;
function keyFor(scope: ClientAppointmentCacheScope, id: string): string | null {
  if (
    !scope.tenantId ||
    !scope.accountId ||
    !scope.clientId ||
    !id ||
    !['client_portal', 'family_portal'].includes(scope.roleKey ?? '')
  )
    return null;
  return JSON.stringify([
    'client-preview',
    scope.tenantId,
    scope.accountId,
    scope.clientId,
    scope.roleKey,
    id,
  ]);
}
export async function readClientAppointmentCache(scope: ClientAppointmentCacheScope, id: string) {
  const key = keyFor(scope, id);
  if (!key) return null;
  const record = await getStoreRecord<CacheRecord>('assignments', key);
  if (
    !record ||
    record.schema !== 1 ||
    record.key !== key ||
    record.payload.id !== id ||
    keyFor(record.scope, id) !== key
  )
    return null;
  const age = Date.now() - Date.parse(record.cachedAt);
  if (!Number.isFinite(age) || age < -60_000 || age > MAX_AGE_MS) return null;
  return {
    ok: true as const,
    data: { ...record.payload, liveVisit: null },
    fromCache: true,
    cachedAt: record.cachedAt,
  };
}
export async function writeClientAppointmentCache(
  scope: ClientAppointmentCacheScope,
  detail: PortalClientAppointmentDetail,
  epoch = offlineCacheEpoch(),
): Promise<boolean> {
  const key = keyFor(scope, detail.id);
  if (!key || epoch !== offlineCacheEpoch()) return false;
  // A cached location must never be presented as the employee's current position.
  const payload = { ...detail, liveVisit: null };
  return putStoreRecord<CacheRecord>('assignments', {
    key,
    schema: 1,
    scope,
    payload,
    cachedAt: new Date().toISOString(),
  });
}
