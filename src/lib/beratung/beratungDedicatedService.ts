import type { RoleKey, ServiceResult } from '@/types';
import type { CounselingListItem } from '@/types/modules/beratung';
import type { Protocol } from '@/types/modules/beratung';
import { fetchCounselingCaseList } from '@/lib/beratung/caseListService';
import { fetchCounselingProtocols } from '@/lib/beratung/moduleExtensionService';

async function wrapCases(
  tenantId: string,
  actorRoleKey: RoleKey | null | undefined,
  filter: (item: CounselingListItem) => boolean,
): Promise<ServiceResult<CounselingListItem[]>> {
  const result = await fetchCounselingCaseList(tenantId, actorRoleKey);
  if (!result.ok) return result;
  return { ok: true, data: result.data.filter(filter) };
}

export async function fetchBeratungMeasuresCases(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CounselingListItem[]>> {
  return wrapCases(
    tenantId,
    actorRoleKey,
    (item) =>
      item.category.toLowerCase().includes('sozial') ||
      item.subject.toLowerCase().includes('maßnahme') ||
      item.subject.toLowerCase().includes('massnahme'),
  );
}

export async function fetchLeistungsberatungCases(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CounselingListItem[]>> {
  return wrapCases(
    tenantId,
    actorRoleKey,
    (item) =>
      item.category.toLowerCase().includes('leistung') ||
      item.subject.toLowerCase().includes('pflegegrad') ||
      item.subject.toLowerCase().includes('leistung'),
  );
}

export async function fetchAngehoerigeCases(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CounselingListItem[]>> {
  return wrapCases(
    tenantId,
    actorRoleKey,
    (item) =>
      item.category.toLowerCase().includes('angehör') ||
      item.subject.toLowerCase().includes('angehör') ||
      item.subject.toLowerCase().includes('familie'),
  );
}

export async function fetchKontaktverlaufProtocols(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<(Protocol & { caseSubject: string })[]>> {
  const result = await fetchCounselingProtocols(tenantId, actorRoleKey);
  if (!result.ok) return result;
  return {
    ok: true,
    data: [...result.data].sort(
      (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
    ),
  };
}
