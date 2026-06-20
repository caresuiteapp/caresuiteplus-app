import type { RoleKey, ServiceResult } from '@/types';
import type { AssignmentListItem } from '@/types/modules/assist';
import { getDemoCareRecordListItems } from '@/data/demo/careRecords';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { fetchAssignmentList } from '@/lib/assist/assignmentListService';
import { listVisitProofs } from '@/lib/assist/assistVisitProofPersistenceService';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { isDemoMode, isSupabaseConfigured } from '@/lib/supabase/config';

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

import type { AssistVisitProofRow } from '@/types/assistExecutionPersistence';

function mapProofToQualityItem(proof: AssistVisitProofRow, index: number): QualityProofItem {
  const snapshot = proof.payloadSnapshot ?? {};
  const clientName = String(snapshot.clientName ?? 'Klient:in');
  const assignmentTitle = String(
    snapshot.serviceName ?? snapshot.assignmentTitle ?? proof.proofNumber ?? 'Leistungsnachweis',
  );
  return {
    id: proof.id,
    tenantId: proof.tenantId,
    clientName,
    assignmentTitle,
    recordedAt: proof.generatedAt ?? proof.createdAt,
    status: proof.status,
    hasSignature: Boolean(proof.signatureId),
    qualityScore: proof.status === 'approved' ? 88 : 70 + (index % 4) * 5,
  };
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

  if (
    getServiceMode() === 'supabase' &&
    isSupabaseConfigured() &&
    !isDemoMode()
  ) {
    const proofs = await listVisitProofs(tenantId, { limit: 50 });
    if (!proofs.ok) return proofs;
    return {
      ok: true,
      data: proofs.data.map((proof, index) => mapProofToQualityItem(proof, index)),
    };
  }

  if (tenantId !== DEMO_TENANT_ID) {
    return { ok: true, data: [] };
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
