import type { RoleKey, ServiceResult, WorkflowStatus } from '@/types';
import type { CareRecordDetail, CareRecordListItem, PdfExportResult } from '@/types/modules/assist';
import {
  buildCareRecordPdfText,
  createDemoCareRecordFromAssignment,
  exportDemoCareRecordPdf,
  getDemoCareRecordById,
  getDemoCareRecordListItems,
  signDemoCareRecord,
} from '@/data/demo/careRecords';
import { enforcePermission } from '@/lib/permissions';
import { blockDemoOnlyInLiveMode, guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { careRecordSupabaseRepository } from '@/lib/services/repositories/careRecordRepository.supabase';

type CareRecordLiveRow = {
  id: string;
  tenant_id: string;
  title: string;
  status: string;
  client_name?: string | null;
  created_at: string;
  updated_at: string;
};

function tenantDenied<T>(tenantId: string): ServiceResult<T> | null {
  const block = guardServiceTenant(tenantId);
  if (block) return block;
  return null;
}

function normalizeStatus(status: string): WorkflowStatus {
  if (
    status === 'aktiv' ||
    status === 'entwurf' ||
    status === 'in_bearbeitung' ||
    status === 'abgeschlossen' ||
    status === 'archiviert'
  ) {
    return status;
  }
  return 'entwurf';
}

function mapLiveRowToListItem(row: CareRecordLiveRow): CareRecordListItem {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    assignmentId: '',
    content: row.title,
    recordedAt: row.created_at,
    status: normalizeStatus(row.status),
    updatedAt: row.updated_at,
    assignmentTitle: row.title,
    clientName: row.client_name?.trim() || '—',
    employeeName: '—',
    hasSignature: row.status === 'abgeschlossen',
    pdfReady: false,
  };
}

function mapLiveRowToDetail(row: CareRecordLiveRow): CareRecordDetail {
  return {
    ...mapLiveRowToListItem(row),
    createdAt: row.created_at,
    durationMinutes: null,
    location: null,
    signature: null,
    pdfExportPath: null,
  };
}

export async function fetchCareRecordList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CareRecordListItem[]>> {
  const denied = enforcePermission<CareRecordListItem[]>(actorRoleKey, 'assist.records.view');
  if (denied) return denied;

  const deniedTenant = tenantDenied<CareRecordListItem[]>(tenantId);
  if (deniedTenant) return deniedTenant;

  if (getServiceMode() === 'supabase') {
    const result = await careRecordSupabaseRepository.list(tenantId);
    if (!result.ok) return result;
    return {
      ok: true,
      data: (result.data as CareRecordLiveRow[]).map(mapLiveRowToListItem),
    };
  }

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

  const deniedTenant = tenantDenied<CareRecordDetail>(tenantId);
  if (deniedTenant) return deniedTenant;

  if (getServiceMode() === 'supabase') {
    const result = await careRecordSupabaseRepository.getById(tenantId, recordId);
    if (!result.ok) return result;
    if (!result.data) return { ok: false, error: 'Nachweis nicht gefunden.' };
    return { ok: true, data: mapLiveRowToDetail(result.data as CareRecordLiveRow) };
  }

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

  const deniedTenant = tenantDenied<CareRecordDetail>(tenantId);
  if (deniedTenant) return deniedTenant;

  const liveBlock = blockDemoOnlyInLiveMode<CareRecordDetail>('Leistungsnachweis anlegen');
  if (liveBlock) return liveBlock;

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

  const deniedTenant = tenantDenied<CareRecordDetail>(tenantId);
  if (deniedTenant) return deniedTenant;

  const liveBlock = blockDemoOnlyInLiveMode<CareRecordDetail>('Leistungsnachweis unterschreiben');
  if (liveBlock) return liveBlock;

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

  const deniedTenant = tenantDenied<PdfExportResult>(tenantId);
  if (deniedTenant) return deniedTenant;

  const liveBlock = blockDemoOnlyInLiveMode<PdfExportResult>('Leistungsnachweis-PDF');
  if (liveBlock) return liveBlock;

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
