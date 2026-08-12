import type { RoleKey, ServiceResult } from '@/types';
import type {
  CarePlanEvaluationListItem,
  CareQualityVisitListItem,
  CareMeasureLiveItem,
  CareRiskLiveItem,
  SisAssessment,
} from '@/types/modules/pflege';
import type { CareDocumentationListItem } from '@/lib/pflege/careDocumentationTypes';
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
import { fetchLiveCareMeasures, fetchLiveCareRisks } from '@/lib/pflege/careQualityR2LiveService';

export {
  createInformationCollection,
  fetchInformationCollectionDetail,
  fetchInformationCollections,
};

export async function fetchPflegeRiskAssessments(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CareRiskLiveItem[]>> {
  return fetchLiveCareRisks(tenantId, actorRoleKey);
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
): Promise<ServiceResult<CareMeasureLiveItem[]>> {
  return fetchLiveCareMeasures(tenantId, actorRoleKey);
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
