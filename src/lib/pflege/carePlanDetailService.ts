import type { RoleKey, ServiceResult } from '@/types';
import type { CarePlanDetail } from '@/types/modules/pflege';
import { getDemoCarePlanById } from '@/data/demo/carePlans';
import { demoClients } from '@/data/demo/clients';
import { demoEmployees } from '@/data/demo/employees';
import { getDemoVitalsForCarePlan } from '@/data/demo/vitalReadings';
import { enforcePermission } from '@/lib/permissions';
import { CLIENT_STATUS_HINTS } from '@/lib/services';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { pflegeSupabaseRepository } from '@/lib/services/repositories/pflegeRepository.supabase';

function applyDetailMeta(plan: NonNullable<ReturnType<typeof getDemoCarePlanById>>): CarePlanDetail {
  const client = demoClients.find((c) => c.id === plan.clientId);
  const nurse = plan.primaryNurseId
    ? demoEmployees.find((e) => e.id === plan.primaryNurseId)
    : undefined;
  const vitals = getDemoVitalsForCarePlan(plan.id);

  return {
    ...plan,
    clientName: client ? `${client.firstName} ${client.lastName}` : 'Unbekannt',
    careLevel: client?.careLevel ?? null,
    city: client?.city ?? '—',
    employeeName: nurse ? `${nurse.firstName} ${nurse.lastName}` : 'Nicht zugewiesen',
    nextActionHint: CLIENT_STATUS_HINTS[plan.status],
    dueVitalsCount: vitals.filter((v) => v.isDue).length,
  };
}

export async function fetchCarePlanDetail(
  planId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CarePlanDetail>> {
  const denied = enforcePermission<CarePlanDetail>(actorRoleKey, 'pflege.plans.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    const result = await pflegeSupabaseRepository.getById(tenantId, planId);
    if (!result.ok) return result;
    if (!result.data) return { ok: false, error: 'Pflegeplan nicht gefunden.' };
    const row = result.data;
    return {
      ok: true,
      data: {
        id: row.id,
        tenantId: row.tenant_id,
        title: row.title,
        validFrom: row.created_at,
        validUntil: row.updated_at,
        status: (row.status === 'aktiv' || row.status === 'entwurf' || row.status === 'archiviert'
          ? row.status
          : 'entwurf') as CarePlanDetail['status'],
        clientId: '',
        primaryNurseId: null,
        sensitivity: 'internal',
        visibility: 'team',
        summary: row.title,
        tasks: [],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        clientName: '—',
        careLevel: null,
        city: '—',
        employeeName: '—',
        nextActionHint: CLIENT_STATUS_HINTS.entwurf,
        dueVitalsCount: 0,
      },
    };
  }

  await new Promise((r) => setTimeout(r, 240));

  const plan = getDemoCarePlanById(planId);
  if (!plan) {
    return { ok: false, error: 'Pflegeplan nicht gefunden.' };
  }

  return { ok: true, data: applyDetailMeta(plan) };
}
