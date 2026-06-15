import type { RoleKey, ServiceResult } from '@/types';
import { getDemoCareRecordById, getDemoCareRecordListItems } from '@/data/demo/careRecords';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { careRecordSupabaseRepository } from '@/lib/services/repositories/careRecordRepository.supabase';
import type {
  CareDocumentationDetail,
  CareDocumentationListItem,
} from './careDocumentationTypes';

function mapDemoListItem(): CareDocumentationListItem[] {
  return getDemoCareRecordListItems().map((record) => ({
    id: record.id,
    tenantId: record.tenantId,
    title: record.assignmentTitle,
    clientName: record.clientName,
    employeeName: record.employeeName,
    recordedAt: record.recordedAt,
    status: record.status,
    updatedAt: record.updatedAt,
    hasSignature: record.hasSignature,
    pdfReady: record.pdfReady,
    contentPreview: record.content.slice(0, 120),
  }));
}

function mapLiveRow(row: {
  id: string;
  tenant_id: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
}): CareDocumentationListItem {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    title: row.title,
    clientName: '—',
    employeeName: '—',
    recordedAt: row.created_at,
    status: (row.status === 'aktiv' ||
    row.status === 'entwurf' ||
    row.status === 'in_bearbeitung' ||
    row.status === 'abgeschlossen' ||
    row.status === 'archiviert'
      ? row.status
      : 'entwurf') as CareDocumentationListItem['status'],
    updatedAt: row.updated_at,
    hasSignature: row.status === 'abgeschlossen',
    pdfReady: false,
    contentPreview: row.title,
  };
}

/** WP377 — Pflegedokumentation Liste (Demo + Live care_records Basis) */
export async function fetchCareDocumentationList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CareDocumentationListItem[]>> {
  const denied = enforcePermission<CareDocumentationListItem[]>(
    actorRoleKey,
    'pflege.plans.view',
  );
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    const result = await careRecordSupabaseRepository.list(tenantId);
    if (!result.ok) return result;
    return { ok: true, data: result.data.map(mapLiveRow) };
  }

  await new Promise((r) => setTimeout(r, 240));
  return { ok: true, data: mapDemoListItem() };
}

export async function fetchCareDocumentationDetail(
  recordId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CareDocumentationDetail>> {
  const denied = enforcePermission<CareDocumentationDetail>(actorRoleKey, 'pflege.plans.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    const result = await careRecordSupabaseRepository.getById(tenantId, recordId);
    if (!result.ok) return result;
    if (!result.data) {
      return { ok: false, error: 'Pflegedokumentation nicht gefunden.' };
    }
    const row = result.data;
    return {
      ok: true,
      data: {
        ...mapLiveRow(row),
        content: row.title,
        durationMinutes: null,
        location: null,
      },
    };
  }

  await new Promise((r) => setTimeout(r, 200));
  const record = getDemoCareRecordById(recordId);
  if (!record) {
    return { ok: false, error: 'Pflegedokumentation nicht gefunden.' };
  }

  return {
    ok: true,
    data: {
      id: record.id,
      tenantId: record.tenantId,
      title: record.assignmentTitle,
      clientName: record.clientName,
      employeeName: record.employeeName,
      recordedAt: record.recordedAt,
      status: record.status,
      updatedAt: record.updatedAt,
      hasSignature: record.hasSignature,
      pdfReady: record.pdfReady,
      contentPreview: record.content.slice(0, 120),
      content: record.content,
      durationMinutes: record.durationMinutes,
      location: record.location,
    },
  };
}
