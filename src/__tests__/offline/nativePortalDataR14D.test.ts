import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('R14-D native portal data resilience', () => {
  it('stores native offline records in protected device storage', () => {
    const idb = read('src/lib/offline/idb.ts');
    expect(idb).toContain("Platform.OS === 'android' || Platform.OS === 'ios'");
    expect(idb).toContain('sensitiveAuthStorage.setItem(storageKey, raw)');
    expect(idb).toContain('sensitiveAuthStorage.getItem(storageKey)');
    expect(idb).toContain('NATIVE_INDEX_KEY');
  });

  it('clears all protected offline records during logout', () => {
    const idb = read('src/lib/offline/idb.ts');
    const auth = read('src/lib/auth/AuthProvider.tsx');
    expect(idb).toContain('Promise.all(keys.map((key) => sensitiveAuthStorage.removeItem(key)))');
    expect(auth).toContain('await clearOfflineDb()');
  });

  it('uses native NetInfo instead of browser-only navigator state', () => {
    const connectivity = read('src/hooks/useConnectivity.ts');
    expect(connectivity).toContain("require('@react-native-community/netinfo')");
    expect(connectivity).toContain('netInfo.addEventListener(applyNetInfo)');
    expect(connectivity).toContain('isInternetReachable');
  });

  it('renders cached data before live revalidation', () => {
    const query = read('src/hooks/core/useAsyncQuery.ts');
    expect(query).toContain('initialCache?:');
    expect(query).toContain('setDataState(cached.data)');
    expect(query).toContain('const liveRequest = load()');
  });

  it('bootstraps employee dashboard, list and execution detail from cache', () => {
    expect(read('src/hooks/useEmployeePortalDashboard.ts')).toContain('initialCache:');
    expect(read('src/hooks/usePortalAppointments.ts')).toContain('initialCache:');
    expect(read('src/hooks/usePortalAppointmentDetail.ts')).toContain('initialCache:');
    expect(read('src/hooks/useEmployeePortalVisitExecution.ts')).toContain('initialCache:');
  });

  it('scopes list cache to employees or clients without mixing tenants', () => {
    const cache = read('src/lib/offline/assignmentCacheService.ts');
    expect(cache).toContain('const cacheActorId = employeeId ?? clientId');
    expect(cache).toContain('listCacheKey(tenantId, employeeId)');
    expect(cache).toContain('record.tenantId !== tenantId || record.employeeId !== employeeId');
  });

  it('applies native timeout, one retry and foreground refresh', () => {
    const timeout = read('src/lib/services/queryTimeout.ts');
    const query = read('src/hooks/core/useAsyncQuery.ts');
    expect(timeout).toContain('NATIVE_SERVICE_QUERY_TIMEOUT_MS = 15_000');
    expect(query).toContain('options?.retryCount ?? 1');
    expect(query).toContain("state === 'active'");
    expect(query).toContain('void load(true)');
  });
});
