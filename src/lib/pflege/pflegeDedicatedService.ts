import type { RoleKey, ServiceResult } from '@/types';
import type {
  CarePlanListItem,
  CarePlanEvaluationListItem,
  CareQualityVisitListItem,
  SisAssessment,
} from '@/types/modules/pflege';
import type { CareDocumentationListItem } from '@/lib/pflege/careDocumentationTypes';
import { fetchCarePlanList } from '@/lib/pflege/carePlanListService';
import { fetchSisAssessments } from '@/lib/pflege/sisListService';
import {
  createInformationCollection,
  fetchInformationCollectionDetail,
  fetchInformationCollections,
} from '@/lib/pflege/informationCollectionService';
import { fetchClinicalHandovers } from '@/lib/pflege/clinicalWorkflowService';
import {
  fetchCarePlanEvaluations,
  fetchCareQualityVisits,
} from '@/lib/pflege/careQualityLiveService';

export {
  createInformationCollection,
  fetchInformationCollectionDetail,
  fetchInformationCollections,
};

async function wrapList<T>(
  fetcher: () => Promise<ServiceResult<T[]>>,
  filter: (items: T[]) => T[],
): Promise<ServiceResult<T[]>> {
  const result = await fetcher();
  if (!result.ok) return result;
  return { ok: true, data: filter(result.data) };
}

export async function fetchPflegeRiskAssessments(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<SisAssessment[]>> {
  return wrapList(
    () => fetchSisAssessments(tenantId, actorRoleKey),
    (items) => items.filter((item) => item.overallScore < 75 || item.status === 'fehlerhaft'),
  );
}

export async function fetchPflegeAssessmentsList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<SisAssessment[]>> {
  return fetchSisAssessments(tenantId, actorRoleKey);
}

export async function fetchPflegeMeasuresList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CarePlanListItem[]>> {
  return wrapList(
    () => fetchCarePlanList(tenantId, actorRoleKey),
    (items) => items.filter((item) => item.alertCount > 0 || item.title.toLowerCase().includes('pflege')),
  );
}

export async function fetchPflegeEvaluationList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CarePlanEvaluationListItem[]>> {
  return fetchCarePlanEvaluations(tenantId, actorRoleKey);
}

export async function fetchPflegeVisitsList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CareQualityVisitListItem[]>> {
  return fetchCareQualityVisits(tenantId, actorRoleKey);
}

export async function fetchPflegeHandoversList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CareDocumentationListItem[]>> {
  return fetchClinicalHandovers(tenantId, actorRoleKey);
}
