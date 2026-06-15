import type { RoleKey, ServiceResult } from '@/types';
import type { SisAssessment } from '@/types/modules/pflege';
import { getDemoSisAssessments, syncDemoSisReviewDeadline } from '@/data/demo/sisAssessments';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { sisAssessmentSupabaseRepository } from '@/lib/services/repositories/sisAssessmentRepository.supabase';

/** WP381 — SIS-Assessments Liste (Demo + Live assessment_runs) */
export async function fetchSisAssessments(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<SisAssessment[]>> {
  const denied = enforcePermission<SisAssessment[]>(actorRoleKey, 'pflege.plans.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    return sisAssessmentSupabaseRepository.listMapped(tenantId);
  }

  await new Promise((r) => setTimeout(r, 240));
  return { ok: true, data: getDemoSisAssessments() };
}

export async function fetchSisAssessmentDetail(
  assessmentId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<SisAssessment>> {
  const denied = enforcePermission<SisAssessment>(actorRoleKey, 'pflege.plans.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    return sisAssessmentSupabaseRepository.getDetailMapped(tenantId, assessmentId);
  }

  await new Promise((r) => setTimeout(r, 200));
  const item = getDemoSisAssessments().find((entry) => entry.id === assessmentId);
  if (!item) {
    return { ok: false, error: 'SIS-Assessment nicht gefunden.' };
  }
  return { ok: true, data: item };
}

/** WP381 — Prüffrist auf Standardintervall (90 Tage) synchronisieren */
export async function syncSisReviewDeadline(
  assessmentId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<SisAssessment>> {
  const denied = enforcePermission<SisAssessment>(actorRoleKey, 'pflege.plans.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    return { ok: false, error: 'Live-Sync: Repository erweitern.' };
  }

  await new Promise((r) => setTimeout(r, 280));
  const synced = syncDemoSisReviewDeadline(assessmentId);
  if (!synced) {
    return { ok: false, error: 'SIS-Assessment nicht gefunden.' };
  }
  return { ok: true, data: synced };
}
