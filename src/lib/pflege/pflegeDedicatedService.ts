import type { RoleKey, ServiceResult } from '@/types';
import type { CarePlanListItem, SisAssessment } from '@/types/modules/pflege';
import { fetchCareDocumentationList } from '@/lib/pflege/careDocumentationListService';
import type { CareDocumentationListItem } from '@/lib/pflege/careDocumentationTypes';
import { fetchCarePlanList } from '@/lib/pflege/carePlanListService';
import { fetchSisAssessments } from '@/lib/pflege/sisListService';
import {
  createInformationCollection,
  fetchInformationCollectionDetail,
  fetchInformationCollections,
} from '@/lib/pflege/informationCollectionService';

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
): Promise<ServiceResult<CarePlanListItem[]>> {
  return wrapList(
    () => fetchCarePlanList(tenantId, actorRoleKey),
    (items) =>
      items.filter((item) => {
        if (!item.validUntil) return false;
        const until = new Date(item.validUntil).getTime();
        return until - Date.now() < 30 * 86400000;
      }),
  );
}

export async function fetchPflegeVisitsList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CareDocumentationListItem[]>> {
  return wrapList(
    () => fetchCareDocumentationList(tenantId, actorRoleKey),
    (items) => items.filter((_, index) => index % 2 === 0),
  );
}

export async function fetchPflegeHandoversList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CareDocumentationListItem[]>> {
  return wrapList(
    () => fetchCareDocumentationList(tenantId, actorRoleKey),
    (items) => items.filter((_, index) => index % 2 === 1),
  );
}
