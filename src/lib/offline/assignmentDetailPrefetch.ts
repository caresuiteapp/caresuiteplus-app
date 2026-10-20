import { offlineCacheEpoch } from './idb';
import type { RoleKey } from '@/types';
import type { CachedPortalAppointmentItem } from './types';
import { isBrowserOffline } from './connectivity';

export const MAX_PREFETCH_DETAILS = 6;
const PREFETCH_THROTTLE_MS = 120;
const PREFETCH_FRESH_MS = 120_000;
let activePrefetchKey: string | null = null;

export type PrefetchDetailResult = {
  attempted: number;
  portalWritten: number;
  executionWritten: number;
  failures: { assignmentId: string; portalError?: string; executionError?: string }[];
};

/** CONSOLE.1 — classify service-layer prefetch errors vs bootstrap REST noise. */
export type PrefetchApiNoiseClass = 'expected_access' | 'not_found' | 'unexpected';

export function classifyPrefetchApiNoise(error: string | undefined): PrefetchApiNoiseClass {
  if (!error?.trim()) return 'unexpected';
  const msg = error.toLowerCase();
  if (/einsatz nicht gefunden|nicht zugewiesen|kein zugriff|kein profil/.test(msg)) {
    return 'not_found';
  }
  if (/berechtigung|permission|row level|policy|403|401|nicht verfügbar/.test(msg)) {
    return 'expected_access';
  }
  return 'unexpected';
}

let activePrefetchAbort: AbortController | null = null;

function hasScopedEmployeeCache(
  tenantId: string | null | undefined,
  employeeId: string | null | undefined,
): tenantId is string {
  return Boolean(tenantId?.trim() && employeeId?.trim());
}

/** Today and upcoming assignments eligible for bounded detail prefetch. */
export function selectPrefetchAssignmentCandidates(
  items: CachedPortalAppointmentItem[],
): CachedPortalAppointmentItem[] {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const sorted = [...items]
    .filter((item) => Boolean(item.id?.trim()))
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  return sorted
    .filter((item) => {
      const start = new Date(item.startsAt);
      return start >= todayStart;
    })
    .slice(0, MAX_PREFETCH_DETAILS);
}

function logPrefetchFailure(assignmentId: string, kind: 'portal' | 'execution', error: string): void {
  if (process.env.NODE_ENV === 'production') return;
  const noiseClass = classifyPrefetchApiNoise(error);
  if (noiseClass === 'expected_access' || noiseClass === 'not_found') return;
  console.debug(`[CareSuite offline] prefetch ${kind} detail failed`, {
    assignmentId,
    error,
    noiseClass,
  });
}

function delayMs(ms: number, signal?: AbortSignal): Promise<void> {
  const abortError = () => Object.assign(new Error('Aborted'), { name: 'AbortError' });
  if (signal?.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    const finish = () => { signal?.removeEventListener('abort', onAbort); resolve(); };
    const timer = setTimeout(finish, ms);
    const onAbort = () => { clearTimeout(timer); signal?.removeEventListener('abort', onAbort); reject(abortError()); };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** Throttled, abortable detail prefetch for visible near-term assignments. */
export async function prefetchAssignmentDetailCaches(
  profileId: string,
  roleKey: RoleKey | null,
  tenantId: string,
  employeeId: string,
  items: CachedPortalAppointmentItem[],
  options?: { signal?: AbortSignal; limit?: number },
): Promise<PrefetchDetailResult> {
  const epoch = offlineCacheEpoch();
  const { fetchEmployeePortalAssignmentDetail } = await import(
    '@/lib/portal/employeePortalExecutionService'
  );
  const { fetchPortalAppointmentDetail } = await import('@/lib/portal/appointmentService');
  const { writeExecutionDetailCache, writePortalAppointmentDetailCache, readExecutionDetailCache, readPortalAppointmentDetailCache } = await import(
    './assignmentCacheService'
  );

  const candidates = selectPrefetchAssignmentCandidates(items).slice(0, options?.limit ?? MAX_PREFETCH_DETAILS);
  const result: PrefetchDetailResult = {
    attempted: 0,
    portalWritten: 0,
    executionWritten: 0,
    failures: [],
  };

  for (const item of candidates) {
    if (options?.signal?.aborted || epoch !== offlineCacheEpoch()) break;

    const assignmentId = item.id;
    const failure: PrefetchDetailResult['failures'][number] = { assignmentId };

    try {
      const [executionCached, portalCached] = await Promise.all([
        readExecutionDetailCache(tenantId, employeeId, assignmentId),
        readPortalAppointmentDetailCache(tenantId, employeeId, assignmentId),
      ]);
      const fresh = (record: { cachedAt: string } | null) => record && Date.now() - Date.parse(record.cachedAt) < PREFETCH_FRESH_MS;
      const needsExecution = !fresh(executionCached);
      const needsPortal = !fresh(portalCached);
      if ((!needsExecution && !needsPortal) || item.cacheStale) continue;
      if (options?.signal?.aborted || epoch !== offlineCacheEpoch()) break;
      result.attempted++;
      const [executionDetail, portalDetail] = await Promise.all([
        needsExecution ? fetchEmployeePortalAssignmentDetail(tenantId, assignmentId, employeeId, roleKey) : null,
        needsPortal ? fetchPortalAppointmentDetail(assignmentId, profileId, roleKey, { tenantId, employeeId }) : null,
      ]);
      if (options?.signal?.aborted || epoch !== offlineCacheEpoch()) break;

      if (executionDetail?.ok) {
        const wrote = await writeExecutionDetailCache(tenantId, employeeId, executionDetail.data);
        if (wrote) result.executionWritten += 1;
        else logPrefetchFailure(assignmentId, 'execution', 'write_failed');
      } else if (executionDetail) {
        failure.executionError = executionDetail.error;
        logPrefetchFailure(assignmentId, 'execution', executionDetail.error);
      }

      if (portalDetail?.ok) {
        const wrote = await writePortalAppointmentDetailCache(tenantId, employeeId, portalDetail.data);
        if (wrote) result.portalWritten += 1;
        else logPrefetchFailure(assignmentId, 'portal', 'write_failed');
      } else if (portalDetail) {
        failure.portalError = portalDetail.error;
        logPrefetchFailure(assignmentId, 'portal', portalDetail.error);
      }

      if (failure.portalError || failure.executionError) {
        result.failures.push(failure);
      }
    } catch (error) {
      if (options?.signal?.aborted) break;
      const message = error instanceof Error ? error.message : 'prefetch_failed';
      result.failures.push({ assignmentId, portalError: message, executionError: message });
      logPrefetchFailure(assignmentId, 'portal', message);
    }

    if (options?.signal?.aborted || epoch !== offlineCacheEpoch()) break;
    if (PREFETCH_THROTTLE_MS > 0) {
      try {
        await delayMs(PREFETCH_THROTTLE_MS, options?.signal);
      } catch {
        break;
      }
    }
  }

  return result;
}

/** Coalesce the same visible batch and let initial rendering finish before prefetch. */
export function scheduleAssignmentDetailPrefetch(
  profileId: string,
  roleKey: RoleKey | null,
  tenantId: string,
  employeeId: string,
  items: CachedPortalAppointmentItem[],
): void {
  if (!hasScopedEmployeeCache(tenantId, employeeId)) return;
  if (!profileId?.trim() || !roleKey) return;
  if (isBrowserOffline()) return;
  if (!items.length) return;

  const key = JSON.stringify([profileId, roleKey, tenantId, employeeId, selectPrefetchAssignmentCandidates(items).map(item => item.id)]);
  if (activePrefetchKey === key) return;
  activePrefetchAbort?.abort();
  activePrefetchKey = key;
  const controller = new AbortController();
  activePrefetchAbort = controller;

  void delayMs(750, controller.signal).then(() => prefetchAssignmentDetailCaches(profileId, roleKey, tenantId, employeeId, items, {
    signal: controller.signal,
  })).catch(() => {}).finally(() => {
    if (activePrefetchAbort === controller) {
      activePrefetchAbort = null;
      activePrefetchKey = null;
    }
  });
}

/** Logout also aborts late prefetch writes. */
export function cancelAssignmentDetailPrefetch(): void {
  activePrefetchAbort?.abort();
  activePrefetchAbort = null;
  activePrefetchKey = null;
}

export const resetAssignmentDetailPrefetchForTests = cancelAssignmentDetailPrefetch;
