import type { RoleKey, ServiceResult } from '@/types';
import type {
  CareAssessment,
  CareAssessmentListItem,
  CareAssessmentStatus,
  CareAssessmentSubjectType,
} from '@/types/modules/careAssessment';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { careAssessmentRepository } from './careAssessmentRepository.supabase';

const viewPermission = (type: CareAssessmentSubjectType) =>
  type === 'resident' ? 'stationaer.residents.view' : 'pflege.plans.view';
const managePermission = (type: CareAssessmentSubjectType) =>
  type === 'resident' ? 'stationaer.assessments.manage' : 'pflege.assessments.manage';

export async function fetchCareAssessments(
  tenantId: string,
  subjectType: CareAssessmentSubjectType,
  role?: RoleKey | null,
): Promise<ServiceResult<CareAssessmentListItem[]>> {
  const denied = enforcePermission<CareAssessmentListItem[]>(role, viewPermission(subjectType));
  if (denied) return denied;
  const tenant = guardServiceTenant(tenantId);
  return tenant ?? careAssessmentRepository.list(tenantId, subjectType);
}

export async function fetchCareAssessment(
  tenantId: string,
  id: string,
  subjectType: CareAssessmentSubjectType,
  role?: RoleKey | null,
): Promise<ServiceResult<CareAssessment>> {
  const denied = enforcePermission<CareAssessment>(role, viewPermission(subjectType));
  if (denied) return denied;
  const tenant = guardServiceTenant(tenantId);
  return tenant ?? careAssessmentRepository.get(tenantId, id);
}

export async function createCareAssessment(
  tenantId: string,
  input: Pick<CareAssessment, 'subjectType' | 'subjectId' | 'subjectName' | 'variant' | 'reason' | 'assessorName'>,
  role?: RoleKey | null,
) {
  const denied = enforcePermission<CareAssessment>(role, managePermission(input.subjectType));
  if (denied) return denied;
  const tenant = guardServiceTenant(tenantId);
  return tenant ?? careAssessmentRepository.create(tenantId, input);
}

export async function saveCareAssessment(tenantId: string, value: CareAssessment, role?: RoleKey | null) {
  const denied = enforcePermission<CareAssessment>(role, managePermission(value.subjectType));
  if (denied) return denied;
  const tenant = guardServiceTenant(tenantId);
  return tenant ?? careAssessmentRepository.save(tenantId, value);
}

export async function transitionCareAssessment(
  tenantId: string,
  value: CareAssessment,
  status: CareAssessmentStatus,
  actorName: string,
  role?: RoleKey | null,
) {
  const denied = enforcePermission<CareAssessment>(role, managePermission(value.subjectType));
  if (denied) return denied;
  const tenant = guardServiceTenant(tenantId);
  return tenant ?? careAssessmentRepository.transition(tenantId, value.id, status, actorName);
}
