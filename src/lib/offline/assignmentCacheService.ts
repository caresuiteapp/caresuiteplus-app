import type { RoleKey, ServiceResult } from '@/types';
import type { EmployeePortalDashboardProjection } from '@/types/portalSystem';
import type { PortalAppointmentDetail } from '@/types/portal/employee';
import type { EmployeePortalAssignmentDetail } from '@/types/modules/employeePortalExecution';
import {
  fetchPortalAppointmentDetail,
  fetchPortalAppointments,
  type PortalAppointmentItem,
} from '@/lib/portal/appointmentService';
import {
  buildEmployeePortalDashboardFromOverview,
  buildEmployeePortalOverviewFromAppointments,
} from '@/lib/portal/employeePortalLiveOverviewService';
import { fetchEmployeePortalAssignmentDetail } from '@/lib/portal/employeePortalExecutionService';
import {
  resolveEmployeePortalAssignmentPendingFlags,
  shouldNavigateEmployeePortalAssignmentToExecution,
} from '@/lib/portal/employeePortalAssignmentCompletion';
import {
  dedupePortalAppointmentOccurrences,
  employeePortalAppointmentIdentity,
} from '@/lib/portal/employeePortalAppointmentIdentity';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import { isBrowserOffline } from './connectivity';
import { getStoreRecord, openOfflineDb, putStoreRecord, putSyncMeta } from './idb';
import type {
  AssignmentCacheMeta,
  AssignmentCacheLoadOptions,
  AssignmentExecutionDetailCacheRecord,
  AssignmentListCacheRecord,
  AssignmentPortalDetailCacheRecord,
  CachedPortalAppointmentItem,
} from './types';
import { normalizeEmployeePortalAssignmentDetail } from '@/lib/portal/normalizeEmployeePortalAssignmentDetail';

const ASSIGNMENTS_STORE = 'assignments' as const;
export const MAX_PREFETCH_DETAILS = 6;

function listCacheKey(tenantId: string, employeeId: string): string {
  return `${tenantId}:${employeeId}:list`;
}

/** Sort: today first → by start time → upcoming chronologically → past last. */
export function sortCachedAssignments(
  items: CachedPortalAppointmentItem[],
): CachedPortalAppointmentItem[] {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(todayStart.getDate() + 1);

  const dayRank = (startsAt: string): number => {
    const start = new Date(startsAt);
    if (start >= todayStart && start < tomorrowStart) return 0;
    if (start >= tomorrowStart) return 1;
    return 2;
  };

  return [...items].sort((a, b) => {
    const rankDiff = dayRank(a.startsAt) - dayRank(b.startsAt);
    if (rankDiff !== 0) return rankDiff;
    return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
  });
}

/** @deprecated Use sortCachedAssignments — kept for internal call sites. */
export const sortPortalAppointmentItems = sortCachedAssignments;

/** Prefer one fresh physical row per real occurrence, including series-id changes. */
export function dedupeAssignmentItemsById(
  items: CachedPortalAppointmentItem[],
): CachedPortalAppointmentItem[] {
  return dedupePortalAppointmentOccurrences(
    [...items].sort((a, b) => Number(Boolean(a.cacheStale)) - Number(Boolean(b.cacheStale))),
  );
}

/** Keep cached assignments missing from online response as stale instead of deleting. */
export function mergeAssignmentListsWithStalePreservation(
  onlineItems: PortalAppointmentItem[],
  cachedItems: CachedPortalAppointmentItem[],
): CachedPortalAppointmentItem[] {
  const onlineOccurrences = new Set(onlineItems.map(employeePortalAppointmentIdentity));
  const fresh = onlineItems.map((item) => ({ ...item, cacheStale: false as const }));
  const stalePreserved = cachedItems
    .filter(
      (item) =>
        item.id && !onlineOccurrences.has(employeePortalAppointmentIdentity(item)),
    )
    .map((item) => ({ ...item, cacheStale: true as const }));
  return dedupeAssignmentItemsById([...fresh, ...stalePreserved]);
}

function portalDetailCacheKey(tenantId: string, employeeId: string, assignmentId: string): string {
  return `${tenantId}:${employeeId}:${assignmentId}:portal`;
}

function executionDetailCacheKey(
  tenantId: string,
  employeeId: string,
  assignmentId: string,
): string {
  return `${tenantId}:${employeeId}:${assignmentId}:execution`;
}

function emptyCacheMeta(): AssignmentCacheMeta {
  return { fromCache: false, cachedAt: null, cacheSource: 'live' };
}

function liveCacheMeta(): AssignmentCacheMeta {
  return { fromCache: false, cachedAt: null, cacheSource: 'live' };
}

export function buildPortalDetailFromListItem(
  item: CachedPortalAppointmentItem,
): PortalAppointmentDetail {
  const assignmentId = item.id;
  const assignmentStatus = item.assignmentStatus;
  const pending = assignmentStatus
      ? resolveEmployeePortalAssignmentPendingFlags({
        status: assignmentStatus,
        assignmentIncomplete: item.assignmentIncomplete,
        documentationPending: item.documentationPending,
        signaturePending: item.signaturePending,
      })
    : { documentationPending: false, signaturePending: false };
  const canStart =
    item.status === 'aktiv' ||
    item.status === 'entwurf' ||
    item.status === 'in_bearbeitung';
  const canOpenExecution = assignmentStatus
    ? shouldNavigateEmployeePortalAssignmentToExecution({
        status: assignmentStatus,
        documentationPending: pending.documentationPending,
        signaturePending: pending.signaturePending,
      })
    : canStart;
  return {
    id: assignmentId,
    assignmentId,
    title: item.title,
    startsAt: item.startsAt,
    endsAt: item.endsAt,
    status: item.status,
    assignmentStatus,
    location: item.location ?? null,
    clientId: item.clientId,
    clientName: item.clientName ?? 'Klient:in',
    clientPhone: null,
    notes: null,
    tasks: [],
    canStartExecution: canStart,
    canOpenExecution,
    executionRoute: `/portal/employee/assignments/${assignmentId}/execute`,
  };
}

function partialCanonicalStatus(
  status: AssignmentStatus,
): EmployeePortalAssignmentDetail['canonicalStatus'] {
  const map: Partial<Record<AssignmentStatus, EmployeePortalAssignmentDetail['canonicalStatus']>> = {
    geplant: 'planned',
    bestaetigt: 'confirmed',
    unterwegs: 'on_the_way',
    angekommen: 'arrived',
    gestartet: 'started',
    pausiert: 'paused',
    beendet: 'finished',
    dokumentation_offen: 'documentation_pending',
    unterschrift_offen: 'signature_pending',
    abgeschlossen: 'completed',
    storniert: 'cancelled',
    nicht_erschienen: 'no_show',
  };
  return map[status] ?? 'confirmed';
}

export function buildExecutionDetailFromListItem(
  item: CachedPortalAppointmentItem,
  tenantId: string,
): EmployeePortalAssignmentDetail {
  const status = item.assignmentStatus ?? 'bestaetigt';
  return {
    assignmentId: item.id,
    tenantId,
    title: item.title,
    clientId: item.clientId,
    clientName: item.clientName ?? 'Klient:in',
    locationAddress: item.location ?? '',
    plannedStartAt: item.startsAt,
    plannedEndAt: item.endsAt,
    actualStartAt: null,
    actualEndAt: null,
    onTheWayAt: null,
    arrivedAt: null,
    status,
    canonicalStatus: partialCanonicalStatus(status),
    notesForEmployee: '',
    accessHints: null,
    emergencyContact: null,
    tasks: [],
    statusHistory: [],
    pauseEvents: [],
    documentationStatus: 'none',
    signatureStatus: 'none',
    requiresSignature: false,
    requiresDocumentation: false,
    requiresRoute: false,
    canStartExecution: false,
    canOpenRoute: false,
    canCaptureGps: false,
    allowedTransitions: [],
    isLocked: true,
    enabledModules: [],
  };
}

const OFFLINE_LIST_ERROR =
  'Keine Verbindung. Zwischengespeicherte Einsätze sind nicht verfügbar.';
const OFFLINE_DETAIL_ERROR =
  'Keine Verbindung. Zwischengespeicherte Einsatzdetails sind nicht verfügbar.';

function normalizeListItems(items: CachedPortalAppointmentItem[]): CachedPortalAppointmentItem[] {
  return sortPortalAppointmentItems(items.filter((item) => Boolean(item.id?.trim())));
}

function hasScopedEmployeeCache(
  tenantId: string | null | undefined,
  employeeId: string | null | undefined,
): tenantId is string {
  return Boolean(tenantId?.trim() && employeeId?.trim());
}

async function readSortedAssignmentListCache(
  tenantId: string,
  employeeId: string,
): Promise<AssignmentListCacheRecord | null> {
  const cached = await readAssignmentListCache(tenantId, employeeId);
  if (!cached?.items.length) return null;
  return { ...cached, items: normalizeListItems(cached.items) };
}

function withCacheMeta<T>(
  result: ServiceResult<T>,
  meta: AssignmentCacheMeta,
): ServiceResult<T> & AssignmentCacheMeta {
  return { ...result, ...meta };
}

async function touchAssignmentSyncMeta(tenantId: string): Promise<void> {
  await putSyncMeta({
    key: 'default',
    lastSyncAt: new Date().toISOString(),
    deviceId: null,
    schemaVersion: 1,
    tenantId,
    updatedAt: new Date().toISOString(),
  });
}

export async function writeAssignmentListCache(
  tenantId: string,
  employeeId: string,
  items: CachedPortalAppointmentItem[],
): Promise<boolean> {
  await openOfflineDb();
  const normalized = normalizeListItems(items);
  if (items.length > 0 && normalized.length === 0) {
    console.warn(
      '[CareSuite offline] writeAssignmentListCache skipped: all items missing id',
      { tenantId, employeeId, inputCount: items.length },
    );
    return false;
  }
  const cachedAt = new Date().toISOString();
  const ok = await putStoreRecord<AssignmentListCacheRecord>(ASSIGNMENTS_STORE, {
    key: listCacheKey(tenantId, employeeId),
    tenantId,
    employeeId,
    kind: 'list',
    items: normalized,
    cachedAt,
  });
  if (!ok) {
    console.warn('[CareSuite offline] writeAssignmentListCache failed', {
      tenantId,
      employeeId,
      itemCount: normalized.length,
    });
    return false;
  }
  await touchAssignmentSyncMeta(tenantId);
  return true;
}

/** Merge online list with existing cache — stale entries are preserved, not deleted. */
export async function mergeAssignmentListCache(
  tenantId: string,
  employeeId: string,
  onlineItems: PortalAppointmentItem[],
): Promise<CachedPortalAppointmentItem[]> {
  const cached = await readAssignmentListCache(tenantId, employeeId);
  const merged = sortPortalAppointmentItems(
    mergeAssignmentListsWithStalePreservation(onlineItems, cached?.items ?? []),
  );
  await writeAssignmentListCache(tenantId, employeeId, merged);
  return merged;
}

/** @deprecated Use mergeAssignmentListCache. */
export const mergeAndWriteAssignmentListCache = mergeAssignmentListCache;

export async function readAssignmentListCache(
  tenantId: string,
  employeeId: string,
): Promise<AssignmentListCacheRecord | null> {
  const record = await getStoreRecord<AssignmentListCacheRecord>(
    ASSIGNMENTS_STORE,
    listCacheKey(tenantId, employeeId),
  );
  if (!record || record.kind !== 'list') return null;
  if (record.tenantId !== tenantId || record.employeeId !== employeeId) return null;
  return record;
}

export async function writePortalAppointmentDetailCache(
  tenantId: string,
  employeeId: string,
  payload: PortalAppointmentDetail,
): Promise<boolean> {
  await openOfflineDb();
  const assignmentId = payload.assignmentId ?? payload.id;
  if (!assignmentId?.trim()) return false;
  return putStoreRecord<AssignmentPortalDetailCacheRecord>(ASSIGNMENTS_STORE, {
    key: portalDetailCacheKey(tenantId, employeeId, assignmentId),
    tenantId,
    employeeId,
    assignmentId,
    kind: 'portal_detail',
    payload,
    cachedAt: new Date().toISOString(),
  });
}

export async function readPortalAppointmentDetailCache(
  tenantId: string,
  employeeId: string,
  assignmentId: string,
): Promise<AssignmentPortalDetailCacheRecord | null> {
  const record = await getStoreRecord<AssignmentPortalDetailCacheRecord>(
    ASSIGNMENTS_STORE,
    portalDetailCacheKey(tenantId, employeeId, assignmentId),
  );
  if (!record || record.kind !== 'portal_detail') return null;
  if (
    record.tenantId !== tenantId ||
    record.employeeId !== employeeId ||
    record.assignmentId !== assignmentId
  ) {
    return null;
  }
  return record;
}

export async function writeExecutionDetailCache(
  tenantId: string,
  employeeId: string,
  payload: EmployeePortalAssignmentDetail,
): Promise<boolean> {
  const normalized = normalizeEmployeePortalAssignmentDetail(payload, {
    assignmentId: payload.assignmentId,
    tenantId,
  });
  return writeExecutionDetailCacheForKey(
    tenantId,
    employeeId,
    payload.assignmentId,
    normalized,
  );
}

async function writeExecutionDetailCacheForKey(
  tenantId: string,
  employeeId: string,
  cacheAssignmentId: string,
  payload: EmployeePortalAssignmentDetail,
): Promise<boolean> {
  await openOfflineDb();
  const normalized = normalizeEmployeePortalAssignmentDetail(payload, {
    assignmentId: cacheAssignmentId,
    tenantId,
  });
  if (!cacheAssignmentId?.trim() || !normalized.assignmentId?.trim()) return false;
  return putStoreRecord<AssignmentExecutionDetailCacheRecord>(ASSIGNMENTS_STORE, {
    key: executionDetailCacheKey(tenantId, employeeId, cacheAssignmentId),
    tenantId,
    employeeId,
    assignmentId: cacheAssignmentId,
    kind: 'execution_detail',
    payload: normalized,
    cachedAt: new Date().toISOString(),
  });
}

export async function readExecutionDetailCache(
  tenantId: string,
  employeeId: string,
  assignmentId: string,
): Promise<AssignmentExecutionDetailCacheRecord | null> {
  const record = await getStoreRecord<AssignmentExecutionDetailCacheRecord>(
    ASSIGNMENTS_STORE,
    executionDetailCacheKey(tenantId, employeeId, assignmentId),
  );
  if (!record || record.kind !== 'execution_detail') return null;
  if (
    record.tenantId !== tenantId ||
    record.employeeId !== employeeId ||
    record.assignmentId !== assignmentId
  ) {
    return null;
  }
  return record;
}

export async function loadPortalAppointmentsWithCache(
  profileId: string,
  roleKey: RoleKey | null,
  tenantId: string | null | undefined,
  employeeId: string | null | undefined,
  clientId?: string | null | undefined,
  options?: AssignmentCacheLoadOptions,
): Promise<ServiceResult<CachedPortalAppointmentItem[]> & AssignmentCacheMeta> {
  await openOfflineDb();
  const cacheActorId = employeeId ?? clientId;
  const scoped = hasScopedEmployeeCache(tenantId, cacheActorId);

  if (scoped && isBrowserOffline(options?.preferCache)) {
    const cached = await readSortedAssignmentListCache(tenantId!, cacheActorId!);
    if (cached) {
      return withCacheMeta(
        { ok: true, data: cached.items },
        { fromCache: true, cachedAt: cached.cachedAt },
      );
    }
    return withCacheMeta({ ok: false, error: OFFLINE_LIST_ERROR }, emptyCacheMeta());
  }

  const online = await fetchPortalAppointments(profileId, roleKey, {
    tenantId,
    employeeId,
    clientId,
  });
  if (online.ok && scoped) {
    const merged = await mergeAssignmentListCache(tenantId!, cacheActorId!, online.data);
    if (employeeId) {
      void import('./assignmentDetailPrefetch').then((mod) =>
        mod.scheduleAssignmentDetailPrefetch(profileId, roleKey, tenantId!, employeeId, merged),
      );
    }
    return withCacheMeta({ ok: true, data: merged }, liveCacheMeta());
  }

  if (scoped) {
    const cached = await readSortedAssignmentListCache(tenantId!, cacheActorId!);
    if (cached) {
      return withCacheMeta(
        { ok: true, data: cached.items },
        { fromCache: true, cachedAt: cached.cachedAt },
      );
    }
  }

  return withCacheMeta<CachedPortalAppointmentItem[]>(
    online.ok ? { ok: true, data: online.data } : { ok: false, error: online.error },
    emptyCacheMeta(),
  );
}

export async function loadPortalAppointmentDetailWithCache(
  appointmentId: string,
  profileId: string,
  roleKey: RoleKey | null,
  tenantId: string | null | undefined,
  employeeId: string | null | undefined,
  options?: AssignmentCacheLoadOptions,
): Promise<ServiceResult<PortalAppointmentDetail> & AssignmentCacheMeta> {
  await openOfflineDb();
  const scoped = hasScopedEmployeeCache(tenantId, employeeId);
  const assignmentKey = appointmentId?.trim() ?? '';

  if (scoped && assignmentKey && isBrowserOffline(options?.preferCache)) {
    const cached = await readPortalAppointmentDetailCache(tenantId!, employeeId!, assignmentKey);
    if (cached) {
      return withCacheMeta(
        { ok: true, data: cached.payload },
        {
          fromCache: true,
          cachedAt: cached.cachedAt,
          cacheSource: 'portal_detail',
        },
      );
    }

    const listCached = await readSortedAssignmentListCache(tenantId!, employeeId!);
    const listItem = listCached?.items.find((item) => item.id === assignmentKey);
    if (listItem) {
      return withCacheMeta(
        { ok: true, data: buildPortalDetailFromListItem(listItem) },
        {
          fromCache: true,
          cachedAt: listCached!.cachedAt,
          partialDetail: true,
          cacheSource: 'list_basis',
        },
      );
    }

    return withCacheMeta({ ok: false, error: OFFLINE_DETAIL_ERROR }, emptyCacheMeta());
  }

  const online = await fetchPortalAppointmentDetail(appointmentId, profileId, roleKey, {
    tenantId,
    employeeId,
  });
  if (online.ok && scoped) {
    const wrote = await writePortalAppointmentDetailCache(tenantId!, employeeId!, online.data);
    if (!wrote) {
      console.warn('[CareSuite offline] writePortalAppointmentDetailCache failed', {
        tenantId,
        employeeId,
        assignmentId: assignmentKey,
      });
    }
    return withCacheMeta(online, liveCacheMeta());
  }

  if (scoped && assignmentKey) {
    const cached = await readPortalAppointmentDetailCache(tenantId!, employeeId!, assignmentKey);
    if (cached) {
      return withCacheMeta(
        { ok: true, data: cached.payload },
        {
          fromCache: true,
          cachedAt: cached.cachedAt,
          cacheSource: 'portal_detail',
        },
      );
    }

    const listCached = await readSortedAssignmentListCache(tenantId!, employeeId!);
    const listItem = listCached?.items.find((item) => item.id === assignmentKey);
    if (listItem) {
      return withCacheMeta(
        { ok: true, data: buildPortalDetailFromListItem(listItem) },
        {
          fromCache: true,
          cachedAt: listCached!.cachedAt,
          partialDetail: true,
          cacheSource: 'list_basis',
        },
      );
    }
  }

  return withCacheMeta<PortalAppointmentDetail>(
    online.ok ? { ok: true, data: online.data } : { ok: false, error: online.error },
    emptyCacheMeta(),
  );
}

export async function loadExecutionDetailWithCache(
  tenantId: string,
  assignmentId: string,
  employeeId: string,
  roleKey: RoleKey | null,
  options?: AssignmentCacheLoadOptions,
): Promise<ServiceResult<EmployeePortalAssignmentDetail> & AssignmentCacheMeta> {
  await openOfflineDb();
  const assignmentKey = assignmentId?.trim() ?? '';

  if (assignmentKey && isBrowserOffline(options?.preferCache)) {
    const cached = await readExecutionDetailCache(tenantId, employeeId, assignmentKey);
    if (cached) {
      return withCacheMeta(
        {
          ok: true,
          data: normalizeEmployeePortalAssignmentDetail(cached.payload, {
            assignmentId: assignmentKey,
            tenantId,
          }),
        },
        {
          fromCache: true,
          cachedAt: cached.cachedAt,
          cacheSource: 'execution_detail',
        },
      );
    }

    const listCached = await readSortedAssignmentListCache(tenantId, employeeId);
    const listItem = listCached?.items.find((item) => item.id === assignmentKey);
    if (listItem) {
      return withCacheMeta(
        { ok: true, data: normalizeEmployeePortalAssignmentDetail(buildExecutionDetailFromListItem(listItem, tenantId), { assignmentId: assignmentKey, tenantId }) },
        {
          fromCache: true,
          cachedAt: listCached!.cachedAt,
          partialDetail: true,
          cacheSource: 'list_basis',
        },
      );
    }

    return withCacheMeta({ ok: false, error: OFFLINE_DETAIL_ERROR }, emptyCacheMeta());
  }

  const online = await fetchEmployeePortalAssignmentDetail(
    tenantId,
    assignmentId,
    employeeId,
    roleKey,
  );
  if (online.ok) {
    const normalizedOnline = normalizeEmployeePortalAssignmentDetail(online.data, {
      assignmentId: assignmentKey,
      tenantId,
    });
    // IndexedDB is a resilience layer, not part of the visible load gate.
    // Safari can take noticeable time to commit IDB writes under memory or
    // battery pressure, so publish live data first and persist in background.
    void Promise.all([
      writeExecutionDetailCache(tenantId, employeeId, normalizedOnline),
      assignmentKey && assignmentKey !== normalizedOnline.assignmentId
        ? writeExecutionDetailCacheForKey(tenantId, employeeId, assignmentKey, normalizedOnline)
        : Promise.resolve(true),
    ])
      .then(([wroteCanonical, wroteRouteAlias]) => {
        if (wroteCanonical && wroteRouteAlias) return;
        console.warn('[CareSuite offline] writeExecutionDetailCache failed', {
          tenantId,
          employeeId,
          assignmentId: assignmentKey,
          resolvedAssignmentId: normalizedOnline.assignmentId,
        });
      })
      .catch(() => {
        console.warn('[CareSuite offline] background execution cache write failed');
      });
    return withCacheMeta({ ok: true, data: normalizedOnline }, liveCacheMeta());
  }

  if (assignmentKey) {
    const cached = await readExecutionDetailCache(tenantId, employeeId, assignmentKey);
    if (cached) {
      return withCacheMeta(
        { ok: true, data: normalizeEmployeePortalAssignmentDetail(cached.payload, { assignmentId: assignmentKey, tenantId }) },
        {
          fromCache: true,
          cachedAt: cached.cachedAt,
          cacheSource: 'execution_detail',
        },
      );
    }

    const listCached = await readSortedAssignmentListCache(tenantId, employeeId);
    const listItem = listCached?.items.find((item) => item.id === assignmentKey);
    if (listItem) {
      return withCacheMeta(
        { ok: true, data: normalizeEmployeePortalAssignmentDetail(buildExecutionDetailFromListItem(listItem, tenantId), { assignmentId: assignmentKey, tenantId }) },
        {
          fromCache: true,
          cachedAt: listCached!.cachedAt,
          partialDetail: true,
          cacheSource: 'list_basis',
        },
      );
    }
  }

  return withCacheMeta<EmployeePortalAssignmentDetail>(
    { ok: false, error: online.error },
    emptyCacheMeta(),
  );
}

export async function loadDashboardProjectionWithCache(
  tenantId: string,
  employeeId: string,
  roleKey: RoleKey | null,
  profileId: string,
  options?: AssignmentCacheLoadOptions,
): Promise<ServiceResult<EmployeePortalDashboardProjection> & AssignmentCacheMeta> {
  const list = await loadPortalAppointmentsWithCache(
    profileId,
    roleKey,
    tenantId,
    employeeId,
    null,
    options,
  );
  if (!list.ok) {
    return withCacheMeta(
      { ok: false, error: list.error },
      { fromCache: list.fromCache, cachedAt: list.cachedAt },
    );
  }

  const overview = buildEmployeePortalOverviewFromAppointments(list.data);
  return withCacheMeta(
    { ok: true, data: buildEmployeePortalDashboardFromOverview(overview) },
    { fromCache: list.fromCache, cachedAt: list.cachedAt },
  );
}

/** Warm IDB and refresh assignment caches after portal login / dashboard open. */
export async function prefetchEmployeeAssignmentCache(
  profileId: string,
  roleKey: RoleKey | null,
  tenantId: string,
  employeeId: string,
): Promise<void> {
  await openOfflineDb();

  const listResult = await fetchPortalAppointments(profileId, roleKey, { tenantId, employeeId });
  if (!listResult.ok || !listResult.data.length) return;

  const merged = await mergeAssignmentListCache(tenantId, employeeId, listResult.data);
  void import('./assignmentDetailPrefetch').then((mod) =>
    mod.scheduleAssignmentDetailPrefetch(profileId, roleKey, tenantId, employeeId, merged),
  );
}

export function formatAssignmentCacheTimestamp(iso: string | null | undefined): string {
  if (!iso) return 'unbekannt';
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
