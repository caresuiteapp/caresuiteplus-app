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
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { assignmentSupabaseRepository } from '@/lib/assist/repositories/assignmentRepository.supabase';
import { SERVICE_ERRORS } from '@/lib/services/errors';

function tenantDenied<T>(tenantId: string): ServiceResult<T> | null {
  const block = guardServiceTenant(tenantId);
  if (block) return block;
  return null;
}

type ServiceRecordRow = {
  id: string;
  tenant_id: string;
  assignment_id: string | null;
  client_id: string;
  employee_id: string | null;
  service_date: string;
  notes: string | null;
  actual_minutes: number | null;
  status: string;
  created_at: string;
  updated_at: string;
};

function mapServiceRecordToListItem(
  row: ServiceRecordRow,
  assignmentTitle: string,
  clientName: string,
  employeeName: string,
): CareRecordListItem {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    assignmentId: row.assignment_id ?? '',
    content: row.notes ?? '',
    recordedAt: row.service_date,
    status: row.status === 'signed' || row.status === 'approved' ? 'abgeschlossen' : 'in_bearbeitung',
    updatedAt: row.updated_at,
    assignmentTitle,
    clientName,
    employeeName,
    hasSignature: row.status === 'signed' || row.status === 'approved',
    pdfReady: row.status === 'signed' || row.status === 'approved',
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
    const supabase = getSupabaseClient();
    if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const { data, error } = await supabase
      .from('service_records')
      .select(
        `
        id, tenant_id, assignment_id, client_id, employee_id,
        service_date, notes, actual_minutes, status, created_at, updated_at,
        clients(first_name, last_name),
        employees(first_name, last_name),
        assignments(title)
      `,
      )
      .eq('tenant_id', tenantId)
      .order('service_date', { ascending: false });

    if (error) return { ok: false, error: toGermanSupabaseError(error) };

    const items = (data ?? []).map((row) => {
      const clients = row.clients as { first_name: string | null; last_name: string | null } | null;
      const employees = row.employees as { first_name: string | null; last_name: string | null } | null;
      const assignments = row.assignments as { title: string | null } | null;
      const clientName = clients
        ? `${clients.first_name ?? ''} ${clients.last_name ?? ''}`.trim()
        : 'Unbekannt';
      const employeeName = employees
        ? `${employees.first_name ?? ''} ${employees.last_name ?? ''}`.trim()
        : 'Unbekannt';
      return mapServiceRecordToListItem(
        row as unknown as ServiceRecordRow,
        assignments?.title ?? 'Einsatz',
        clientName || 'Unbekannt',
        employeeName || 'Unbekannt',
      );
    });

    return { ok: true, data: items };
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
    const supabase = getSupabaseClient();
    if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const { data, error } = await supabase
      .from('service_records')
      .select(
        `
        id, tenant_id, assignment_id, client_id, employee_id,
        service_date, notes, actual_minutes, status, created_at, updated_at, pdf_url,
        clients(first_name, last_name),
        employees(first_name, last_name),
        assignments(title, address_snapshot)
      `,
      )
      .eq('tenant_id', tenantId)
      .eq('id', recordId)
      .maybeSingle();

    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    if (!data) return { ok: false, error: 'Nachweis nicht gefunden.' };

    const clients = data.clients as { first_name: string | null; last_name: string | null } | null;
    const employees = data.employees as { first_name: string | null; last_name: string | null } | null;
    const assignments = data.assignments as {
      title: string | null;
      address_snapshot: string | null;
    } | null;

    const clientName = clients
      ? `${clients.first_name ?? ''} ${clients.last_name ?? ''}`.trim()
      : 'Unbekannt';
    const employeeName = employees
      ? `${employees.first_name ?? ''} ${employees.last_name ?? ''}`.trim()
      : 'Unbekannt';
    const hasSignature = data.status === 'signed' || data.status === 'approved';

    const detail: CareRecordDetail = {
      id: data.id,
      tenantId: data.tenant_id,
      assignmentId: data.assignment_id ?? '',
      content: data.notes ?? '',
      recordedAt: data.service_date,
      status: hasSignature ? 'abgeschlossen' : 'in_bearbeitung',
      updatedAt: data.updated_at,
      assignmentTitle: assignments?.title ?? 'Einsatz',
      clientName: clientName || 'Unbekannt',
      employeeName: employeeName || 'Unbekannt',
      hasSignature,
      pdfReady: hasSignature,
      createdAt: data.created_at,
      durationMinutes: data.actual_minutes,
      location: assignments?.address_snapshot ?? null,
      signature: null,
      pdfExportPath: data.pdf_url,
    };

    return { ok: true, data: detail };
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

  if (getServiceMode() === 'supabase') {
    const prepared = await assignmentSupabaseRepository.prepareServiceRecord(tenantId, assignmentId);
    if (!prepared.ok) return prepared;
    if (!prepared.data) {
      return {
        ok: false,
        error: 'Leistungsnachweis kann erst nach abgeschlossenem Einsatz erstellt werden.',
      };
    }
    return fetchCareRecordDetail(prepared.data.id, tenantId, actorRoleKey);
  }

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

  if (getServiceMode() === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const { error } = await supabase
      .from('service_records')
      .update({ status: 'signed', updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('id', recordId);

    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return fetchCareRecordDetail(recordId, tenantId, actorRoleKey);
  }

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

  if (getServiceMode() === 'supabase') {
    const detailResult = await fetchCareRecordDetail(recordId, tenantId, actorRoleKey);
    if (!detailResult.ok) return detailResult;
    if (!detailResult.data.hasSignature) {
      return { ok: false, error: 'PDF-Export erst nach Unterschrift möglich.' };
    }

    const fileName = `Leistungsnachweis-${detailResult.data.id}.pdf`;
    return {
      ok: true,
      data: {
        fileName,
        generatedAt: new Date().toISOString(),
        contentPreview: detailResult.data.content,
        storagePath: detailResult.data.pdfExportPath ?? fileName,
      },
    };
  }

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
