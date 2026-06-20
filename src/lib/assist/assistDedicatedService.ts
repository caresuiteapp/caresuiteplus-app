import type { RoleKey, ServiceResult } from '@/types';
import type { AssignmentListItem } from '@/types/modules/assist';
import { getDemoCareRecordListItems } from '@/data/demo/careRecords';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { fetchAssignmentList } from '@/lib/assist/assignmentListService';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';

export type QualityProofItem = {
  id: string;
  tenantId: string;
  clientName: string;
  assignmentTitle: string;
  recordedAt: string;
  status: string;
  hasSignature: boolean;
  qualityScore: number;
};

async function demoDelay(ms = 220): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

export async function fetchAssistTasksList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<AssignmentListItem[]>> {
  const result = await fetchAssignmentList(tenantId, actorRoleKey);
  if (!result.ok) return result;
  return {
    ok: true,
    data: result.data.filter(
      (item) =>
        item.status === 'aktiv' ||
        item.status === 'in_bearbeitung' ||
        item.title.toLowerCase().includes('aufgabe'),
    ),
  };
}

export async function fetchAssistQualityProofs(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<QualityProofItem[]>> {
  const denied = enforcePermission<QualityProofItem[]>(actorRoleKey, 'assist.records.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  if (tenantId !== DEMO_TENANT_ID) {
    return { ok: false, error: 'Qualitätsnachweise: Live-Repository erweitern.' };
  }
  await demoDelay();
  return {
    ok: true,
    data: getDemoCareRecordListItems().map((record, index) => ({
      id: record.id,
      tenantId: record.tenantId,
      clientName: record.clientName,
      assignmentTitle: record.assignmentTitle,
      recordedAt: record.recordedAt,
      status: record.status,
      hasSignature: record.hasSignature,
      qualityScore: 70 + (index % 4) * 7,
    })),
  };
}
