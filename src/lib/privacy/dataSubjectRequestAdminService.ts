import type { RoleKey, ServiceResult } from '@/types';
import {
  dataSubjectRequestsDemo,
  updateDemoDataSubjectRequestStatus,
} from '@/data/demo/dataSubjectRequestsDemo';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { isDataSubjectRequestBackendReady } from './dataRequestConfig';
import { buildDataSubjectRequestsAdminCsv } from './dataSubjectRequestSla';
import { dataSubjectRequestsSupabaseRepository } from './dataSubjectRequests.supabase';
import type { DataSubjectRequest, DataSubjectRequestStatus } from './dataSubjectRequest.types';

/** Mandanten-Admin: Betroffenenanfragen lesen (business_admin). */
export async function fetchDataSubjectRequestsForAdmin(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<DataSubjectRequest[]>> {
  const denied = enforcePermission<DataSubjectRequest[]>(actorRoleKey, 'security.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    return dataSubjectRequestsSupabaseRepository.listForTenant(tenantId);
  }

  await new Promise((r) => setTimeout(r, 160));
  return {
    ok: true,
    data: dataSubjectRequestsDemo.filter((item) => item.tenantId === tenantId),
  };
}

/** Mandanten-Admin: Status einer Betroffenenanfrage aktualisieren (security.manage). */
export async function updateDataSubjectRequestStatusForAdmin(
  tenantId: string,
  requestId: string,
  status: DataSubjectRequestStatus,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<DataSubjectRequest>> {
  const denied = enforcePermission<DataSubjectRequest>(actorRoleKey, 'security.manage');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    return dataSubjectRequestsSupabaseRepository.updateStatus(tenantId, requestId, status);
  }

  await new Promise((r) => setTimeout(r, 120));
  const updated = updateDemoDataSubjectRequestStatus(requestId, status);
  if (!updated || updated.tenantId !== tenantId) {
    return { ok: false, error: 'Anfrage nicht gefunden.' };
  }
  return { ok: true, data: updated };
}

/** Mandanten-Admin: CSV-Export der Betroffenenanfragen (nur Live nach Migration 0031). */
export async function exportDataSubjectRequestsForAdmin(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ csv: string; rowCount: number }>> {
  const denied = enforcePermission<{ csv: string; rowCount: number }>(
    actorRoleKey,
    'security.view',
  );
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (!isDataSubjectRequestBackendReady()) {
    return {
      ok: false,
      error:
        'CSV-Export ist nach Migration 0031 und Live-Supabase verfügbar. Demo-Modus: Liste nur in der App.',
    };
  }

  const list = await fetchDataSubjectRequestsForAdmin(tenantId, actorRoleKey);
  if (!list.ok) return list;

  const csv = buildDataSubjectRequestsAdminCsv(list.data);
  return { ok: true, data: { csv, rowCount: list.data.length } };
}
