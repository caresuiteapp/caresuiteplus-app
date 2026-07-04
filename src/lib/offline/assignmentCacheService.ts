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
import { fetchLiveEmployeePortalAssignmentDetail } from '@/lib/portal/employeePortalExecutionLiveService';
import { fetchEmployeePortalAssignmentDetail } from '@/lib/portal/employeePortalExecutionService';
import { getStoreRecord, openOfflineDb, putStoreRecord, putSyncMeta } from './idb';
import type {
  AssignmentCacheMeta,
  AssignmentExecutionDetailCacheRecord,
  AssignmentListCacheRecord,
  AssignmentPortalDetailCacheRecord,
} from './types';

const ASSIGNMENTS_STORE = 'assignments' as const;
const MAX_PREFETCH_DETAILS = 6;

function listCacheKey(tenantId: string, employeeId: string): string {
  return `${tenantId}:${employeeId}:list`;
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
  return { fromCache: false, cachedAt: null };
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
  items: PortalAppointmentItem[],
): Promise<boolean> {
  const cachedAt = new Date().toISOString();
  const ok = await putStoreRecord<AssignmentListCacheRecord>(ASSIGNMENTS_STORE, {
    key: listCacheKey(tenantId, employeeId),
    tenantId,
    employeeId,
    kind: 'list',
    items,
    cachedAt,
  });
  if (ok) await touchAssignmentSyncMeta(tenantId);
  return ok;
}

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
  const assignmentId = payload.assignmentId ?? payload.id;
  if (!assignmentId) return false;
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
  return putStoreRecord<AssignmentExecutionDetailCacheRecord>(ASSIGNMENTS_STORE, {
    key: executionDetailCacheKey(tenantId, employeeId, payload.assignmentId),
    tenantId,
    employeeId,
    assignmentId: payload.assignmentId,
    kind: 'execution_detail',
    payload,
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
): Promise<ServiceResult<PortalAppointmentItem[]> & AssignmentCacheMeta> {
  const online = await fetchPortalAppointments(profileId, roleKey, { tenantId, employeeId });
  if (online.ok && tenantId?.trim() && employeeId?.trim()) {
    void writeAssignmentListCache(tenantId, employeeId, online.data);
    return withCacheMeta(online, emptyCacheMeta());
  }

  if (tenantId?.trim() && employeeId?.trim()) {
    const cached = await readAssignmentListCache(tenantId, employeeId);
    if (cached?.items.length) {
      return withCacheMeta({ ok: true, data: cached.items }, {
        fromCache: true,
        cachedAt: cached.cachedAt,
      });
    }
  }

  return withCacheMeta(online, emptyCacheMeta());
}

export async function loadPortalAppointmentDetailWithCache(
  appointmentId: string,
  profileId: string,
  roleKey: RoleKey | null,
  tenantId: string | null | undefined,
  employeeId: string | null | undefined,
): Promise<ServiceResult<PortalAppointmentDetail> & AssignmentCacheMeta> {
  const online = await fetchPortalAppointmentDetail(appointmentId, profileId, roleKey, {
    tenantId,
    employeeId,
  });
  if (online.ok && tenantId?.trim() && employeeId?.trim()) {
    void writePortalAppointmentDetailCache(tenantId, employeeId, online.data);
    return withCacheMeta(online, emptyCacheMeta());
  }

  if (tenantId?.trim() && employeeId?.trim() && appointmentId?.trim()) {
    const cached = await readPortalAppointmentDetailCache(tenantId, employeeId, appointmentId);
    if (cached) {
      return withCacheMeta({ ok: true, data: cached.payload }, {
        fromCache: true,
        cachedAt: cached.cachedAt,
      });
    }
  }

  return withCacheMeta(online, emptyCacheMeta());
}

export async function loadExecutionDetailWithCache(
  tenantId: string,
  assignmentId: string,
  employeeId: string,
  roleKey: RoleKey | null,
): Promise<ServiceResult<EmployeePortalAssignmentDetail> & AssignmentCacheMeta> {
  const online = await fetchEmployeePortalAssignmentDetail(
    tenantId,
    assignmentId,
    employeeId,
    roleKey,
  );
  if (online.ok) {
    void writeExecutionDetailCache(tenantId, employeeId, online.data);
    return withCacheMeta(online, emptyCacheMeta());
  }

  const cached = await readExecutionDetailCache(tenantId, employeeId, assignmentId);
  if (cached) {
    return withCacheMeta({ ok: true, data: cached.payload }, {
      fromCache: true,
      cachedAt: cached.cachedAt,
    });
  }

  return withCacheMeta(online, emptyCacheMeta());
}

export async function loadDashboardProjectionWithCache(
  tenantId: string,
  employeeId: string,
  roleKey: RoleKey | null,
  profileId: string,
): Promise<ServiceResult<EmployeePortalDashboardProjection> & AssignmentCacheMeta> {
  const list = await loadPortalAppointmentsWithCache(profileId, roleKey, tenantId, employeeId);
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

  await writeAssignmentListCache(tenantId, employeeId, listResult.data);

  const now = new Date();
  const candidates = listResult.data
    .filter((item) => {
      const start = new Date(item.startsAt);
      return start >= now || start.toDateString() === now.toDateString();
    })
    .slice(0, MAX_PREFETCH_DETAILS);

  await Promise.all(
    candidates.map(async (item) => {
      const detail = await fetchLiveEmployeePortalAssignmentDetail(
        tenantId,
        item.id,
        employeeId,
        roleKey,
      );
      if (detail.ok) {
        await writeExecutionDetailCache(tenantId, employeeId, detail.data);
      }
    }),
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
