import type { RoleKey, ServiceResult } from '@/types';
import type { BeratungDashboardStats, CounselingListItem } from '@/types/modules/beratung';
import {
  createDemoCounselingCase,
  getDemoCounselingCaseListItems,
} from '@/data/demo/counselingCases';
import {
  isAppointmentUpcoming,
  isCaseClosedThisMonth,
  isCaseOpen,
} from './counselingCaseUtils';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { beratungSupabaseRepository } from '@/lib/services/repositories/beratungRepository.supabase';

function buildDashboardStats(items: CounselingListItem[]): BeratungDashboardStats {
  return {
    totalCases: items.length,
    openCount: items.filter((item) => isCaseOpen(item.status)).length,
    activeCount: items.filter((item) => item.status === 'aktiv').length,
    upcomingAppointmentsCount: items.filter((item) =>
      isAppointmentUpcoming(item.nextAppointmentAt),
    ).length,
    closedThisMonthCount: items.filter((item) =>
      isCaseClosedThisMonth(
        item.status === 'abgeschlossen' ? item.updatedAt : null,
      ),
    ).length,
  };
}

function mapLiveCaseRow(row: {
  id: string;
  tenant_id: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
}): CounselingListItem {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    subject: row.title,
    category: 'Allgemein',
    openedAt: row.created_at,
    nextAppointmentAt: null,
    status: (row.status === 'aktiv' || row.status === 'entwurf' || row.status === 'abgeschlossen'
      ? row.status
      : 'entwurf') as CounselingListItem['status'],
    updatedAt: row.updated_at,
    clientName: '—',
    counselorName: '—',
  };
}

export async function fetchCounselingCaseList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CounselingListItem[]>> {
  const denied = enforcePermission<CounselingListItem[]>(
    actorRoleKey,
    'beratung.cases.view',
  );
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    const result = await beratungSupabaseRepository.list(tenantId);
    if (!result.ok) return result;
    return { ok: true, data: result.data.map(mapLiveCaseRow) };
  }

  await new Promise((r) => setTimeout(r, 260));
  return { ok: true, data: getDemoCounselingCaseListItems() };
}

export async function fetchBeratungDashboardStats(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<BeratungDashboardStats>> {
  const denied = enforcePermission<BeratungDashboardStats>(actorRoleKey, 'beratung.access');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  await new Promise((r) => setTimeout(r, 220));
  const listResult = await fetchCounselingCaseList(tenantId, actorRoleKey);
  if (!listResult.ok) return listResult;

  return { ok: true, data: buildDashboardStats(listResult.data) };
}

export async function fetchRecentCounselingCases(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CounselingListItem[]>> {
  const listResult = await fetchCounselingCaseList(tenantId, actorRoleKey);
  if (!listResult.ok) return listResult;

  const recent = listResult.data
    .filter((item) => isCaseOpen(item.status))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 4);

  return { ok: true, data: recent };
}

export async function createCounselingCase(
  actorRoleKey: RoleKey | null | undefined,
  input: { subject: string; category?: string },
): Promise<ServiceResult<{ id: string }>> {
  const denied = enforcePermission<{ id: string }>(actorRoleKey, 'beratung.cases.view');
  if (denied) return denied;

  if (!input.subject.trim()) {
    return { ok: false, error: 'Bezeichnung ist erforderlich.' };
  }

  if (getServiceMode() === 'supabase') {
    return { ok: false, error: 'Live-Anlage: Repository erweitern.' };
  }

  await new Promise((r) => setTimeout(r, 300));
  const created = createDemoCounselingCase({
    subject: input.subject.trim(),
    category: input.category,
  });
  return { ok: true, data: { id: created.id } };
}
