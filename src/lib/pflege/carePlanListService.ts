import type { RoleKey, ServiceResult } from '@/types';
import type { CarePlanListItem, PflegeDashboardStats } from '@/types/modules/pflege';
import {
  countActiveCarePlans,
  createDemoCarePlan,
  getDemoCarePlanListItems,
} from '@/data/demo/carePlans';
import { countDueVitals, countVitalAlerts } from '@/data/demo/vitalReadings';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { pflegeSupabaseRepository } from '@/lib/services/repositories/pflegeRepository.supabase';

function buildDashboardStats(items: CarePlanListItem[]): PflegeDashboardStats {
  return {
    totalPlans: items.length,
    activePlansCount: items.filter((i) => i.status === 'aktiv').length,
    dueVitalsCount: countDueVitals(),
    alertsCount: countVitalAlerts() + items.reduce((sum, item) => sum + item.alertCount, 0),
  };
}

function mapLiveCarePlanRow(row: {
  id: string;
  tenant_id: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
}): CarePlanListItem {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    title: row.title,
    validFrom: row.created_at,
    validUntil: row.updated_at,
    status: (row.status === 'aktiv' || row.status === 'entwurf' || row.status === 'archiviert'
      ? row.status
      : 'entwurf') as CarePlanListItem['status'],
    clientId: '',
    updatedAt: row.updated_at,
    clientName: '—',
    careLevel: null,
    alertCount: 0,
  };
}

export async function fetchCarePlanList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CarePlanListItem[]>> {
  const denied = enforcePermission<CarePlanListItem[]>(actorRoleKey, 'pflege.plans.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    const result = await pflegeSupabaseRepository.list(tenantId);
    if (!result.ok) return result;
    return { ok: true, data: result.data.map(mapLiveCarePlanRow) };
  }

  await new Promise((r) => setTimeout(r, 260));
  return { ok: true, data: getDemoCarePlanListItems() };
}

export async function fetchPflegeDashboardStats(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<PflegeDashboardStats>> {
  const denied = enforcePermission<PflegeDashboardStats>(actorRoleKey, 'pflege.access');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const listResult = await fetchCarePlanList(tenantId, actorRoleKey);
  if (!listResult.ok) return listResult;

  if (getServiceMode() === 'supabase') {
    return {
      ok: true,
      data: {
        totalPlans: listResult.data.length,
        activePlansCount: listResult.data.filter((i) => i.status === 'aktiv').length,
        dueVitalsCount: 0,
        alertsCount: 0,
      },
    };
  }

  await new Promise((r) => setTimeout(r, 220));
  return { ok: true, data: buildDashboardStats(listResult.data) };
}

export async function fetchActiveCarePlans(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CarePlanListItem[]>> {
  const listResult = await fetchCarePlanList(tenantId, actorRoleKey);
  if (!listResult.ok) return listResult;

  const active = listResult.data
    .filter((item) => item.status === 'aktiv')
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return { ok: true, data: active };
}

export async function createCarePlan(
  actorRoleKey: RoleKey | null | undefined,
  input: { title: string; sisTopic: string },
): Promise<ServiceResult<{ id: string }>> {
  const denied = enforcePermission<{ id: string }>(actorRoleKey, 'pflege.plans.view');
  if (denied) return denied;

  if (!input.title.trim() || !input.sisTopic.trim()) {
    return { ok: false, error: 'Bezeichnung und SIS-Thema sind erforderlich.' };
  }

  if (getServiceMode() === 'supabase') {
    return { ok: false, error: 'Live-Anlage: Repository erweitern.' };
  }

  await new Promise((r) => setTimeout(r, 300));
  const created = createDemoCarePlan({
    title: input.title.trim(),
    sisTopic: input.sisTopic.trim(),
  });
  return { ok: true, data: { id: created.id } };
}
