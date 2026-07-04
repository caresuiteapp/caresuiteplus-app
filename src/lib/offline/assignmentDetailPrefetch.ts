import type { RoleKey } from '@/types';
import type { CachedPortalAppointmentItem } from './types';
import { isBrowserOffline } from './connectivity';

export const MAX_PREFETCH_DETAILS = 6;
const PREFETCH_THROTTLE_MS = 120;

export type PrefetchDetailResult = {
  attempted: number;
  portalWritten: number;
  executionWritten: number;
  failures: Array<{ assignmentId: string; portalError?: string; executionError?: string }>;
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
  if (signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

/** Throttled, abortable detail prefetch for visible near-term assignments. */
export async function prefetchAssignmentDetailCaches(
  profileId: string,
  roleKey: RoleKey | null,
  tenantId: string,
  employeeId: string,
  items: CachedPortalAppointmentItem[],
  options?: { signal?: AbortSignal },
): Promise<PrefetchDetailResult> {
  const { fetchLiveEmployeePortalAssignmentDetail } = await import(
    '@/lib/portal/employeePortalExecutionLiveService'
  );
  const { fetchPortalAppointmentDetail } = await import('@/lib/portal/appointmentService');
  const { writeExecutionDetailCache, writePortalAppointmentDetailCache } = await import(
    './assignmentCacheService'
  );

  const candidates = selectPrefetchAssignmentCandidates(items);
  const result: PrefetchDetailResult = {
    attempted: candidates.length,
    portalWritten: 0,
    executionWritten: 0,
    failures: [],
  };

  for (const item of candidates) {
    if (options?.signal?.aborted) break;

    const assignmentId = item.id;
    const failure: PrefetchDetailResult['failures'][number] = { assignmentId };

    try {
      const [executionDetail, portalDetail] = await Promise.all([
        fetchLiveEmployeePortalAssignmentDetail(tenantId, assignmentId, employeeId, roleKey),
        fetchPortalAppointmentDetail(assignmentId, profileId, roleKey, { tenantId, employeeId }),
      ]);

      if (executionDetail.ok) {
        const wrote = await writeExecutionDetailCache(tenantId, employeeId, executionDetail.data);
        if (wrote) result.executionWritten += 1;
        else logPrefetchFailure(assignmentId, 'execution', 'write_failed');
      } else {
        failure.executionError = executionDetail.error;
        logPrefetchFailure(assignmentId, 'execution', executionDetail.error);
      }

      if (portalDetail.ok) {
        const wrote = await writePortalAppointmentDetailCache(tenantId, employeeId, portalDetail.data);
        if (wrote) result.portalWritten += 1;
        else logPrefetchFailure(assignmentId, 'portal', 'write_failed');
      } else {
        failure.portalError = portalDetail.error;
        logPrefetchFailure(assignmentId, 'portal', portalDetail.error);
      }

      if (failure.portalError || failure.executionError) {
        result.failures.push(failure);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') break;
      const message = error instanceof Error ? error.message : 'prefetch_failed';
      result.failures.push({ assignmentId, portalError: message, executionError: message });
      logPrefetchFailure(assignmentId, 'portal', message);
    }

    if (options?.signal?.aborted) break;
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

/** Cancel any in-flight detail prefetch and start a new bounded run. */
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

  activePrefetchAbort?.abort();
  const controller = new AbortController();
  activePrefetchAbort = controller;

  void prefetchAssignmentDetailCaches(profileId, roleKey, tenantId, employeeId, items, {
    signal: controller.signal,
  }).finally(() => {
    if (activePrefetchAbort === controller) {
      activePrefetchAbort = null;
    }
  });
}

/** Test-only: abort in-flight detail prefetch between cases. */
export function resetAssignmentDetailPrefetchForTests(): void {
  activePrefetchAbort?.abort();
  activePrefetchAbort = null;
}
