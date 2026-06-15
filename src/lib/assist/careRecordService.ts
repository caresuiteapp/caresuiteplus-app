import type { RoleKey, ServiceResult } from '@/types';
import type { CareRecordDetail, CareRecordListItem, PdfExportResult } from '@/types/modules/assist';
import {
  buildCareRecordPdfText,
  createDemoCareRecordFromAssignment,
  exportDemoCareRecordPdf,
  getDemoCareRecordById,
  getDemoCareRecordListItems,
  signDemoCareRecord,
} from '@/data/demo/careRecords';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { enforcePermission } from '@/lib/permissions';

export async function fetchCareRecordList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CareRecordListItem[]>> {
  const denied = enforcePermission<CareRecordListItem[]>(actorRoleKey, 'assist.records.view');
  if (denied) return denied;
  if (tenantId !== DEMO_TENANT_ID) return { ok: false, error: 'Kein Zugriff auf diesen Mandanten.' };

  await new Promise((r) => setTimeout(r, 280));
  return { ok: true, data: getDemoCareRecordListItems() };
}

export async function fetchCareRecordDetail(
  recordId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CareRecordDetail>> {
  const denied = enforcePermission<CareRecordDetail>(actorRoleKey, 'assist.records.view');
  if (denied) return denied;
  if (tenantId !== DEMO_TENANT_ID) return { ok: false, error: 'Kein Zugriff auf diesen Mandanten.' };

  await new Promise((r) => setTimeout(r, 240));
  const record = getDemoCareRecordById(recordId);
  if (!record) return { ok: false, error: 'Nachweis nicht gefunden.' };
  return { ok: true, data: record };
}

export async function createCareRecordFromExecution(
  assignmentId: string,
  content: string,
  durationMinutes: number | null,
  location: string | null,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CareRecordDetail>> {
  const denied = enforcePermission<CareRecordDetail>(actorRoleKey, 'assist.records.create');
  if (denied) return denied;
  if (tenantId !== DEMO_TENANT_ID) return { ok: false, error: 'Kein Zugriff auf diesen Mandanten.' };

  await new Promise((r) => setTimeout(r, 350));
  const record = createDemoCareRecordFromAssignment(assignmentId, content, durationMinutes, location);
  if (!record) return { ok: false, error: 'Nachweis konnte nicht erstellt werden.' };
  return { ok: true, data: record };
}

export async function signCareRecord(
  recordId: string,
  tenantId: string,
  signedByProfileId: string,
  signedByName: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CareRecordDetail>> {
  const denied = enforcePermission<CareRecordDetail>(actorRoleKey, 'assist.records.sign');
  if (denied) return denied;
  if (tenantId !== DEMO_TENANT_ID) return { ok: false, error: 'Kein Zugriff auf diesen Mandanten.' };

  await new Promise((r) => setTimeout(r, 400));
  const record = signDemoCareRecord(recordId, signedByProfileId, signedByName);
  if (!record) return { ok: false, error: 'Unterschrift fehlgeschlagen.' };
  return { ok: true, data: record };
}

export async function exportCareRecordPdf(
  recordId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<PdfExportResult>> {
  const denied = enforcePermission<PdfExportResult>(actorRoleKey, 'assist.records.export');
  if (denied) return denied;
  if (tenantId !== DEMO_TENANT_ID) return { ok: false, error: 'Kein Zugriff auf diesen Mandanten.' };

  await new Promise((r) => setTimeout(r, 500));

  const record = getDemoCareRecordById(recordId);
  if (!record) return { ok: false, error: 'Nachweis nicht gefunden.' };
  if (!record.hasSignature) {
    return { ok: false, error: 'PDF-Export erst nach Unterschrift möglich.' };
  }

  const path = exportDemoCareRecordPdf(recordId);
  if (!path) return { ok: false, error: 'PDF konnte nicht erzeugt werden.' };

  const fileName = `Leistungsnachweis-${record.id}.pdf`;
  return {
    ok: true,
    data: {
      fileName,
      generatedAt: new Date().toISOString(),
      contentPreview: buildCareRecordPdfText(record),
      storagePath: path,
    },
  };
}
