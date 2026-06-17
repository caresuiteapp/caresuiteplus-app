import type { RoleKey, ServiceResult } from '@/types';
import { getDemoEmployeePersonnelFile } from '@/data/demo/employeePersonnelFile';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import {
  buildBackgroundCheckLiveUpdatePayload,
  buildQualificationFlagsLiveUpdatePayload,
  type EmployeeBackgroundCheckPatch,
  type EmployeeQualificationFlagsPatch,
} from './employeePersonnelFileMapper';
import { evaluateEmployeeDeployability } from './employeeDeployabilityService';
import { fetchEmployeePersonnelFile } from './employeePersonnelFileService';
import { getCachedEmployeePersonnelFile, loadEmployeePersonnelFileLive } from './employeePersonnelFileLiveLoader';

const STORAGE_BUCKET = 'office-documents';

export type EmployeeDocumentUploadInput = {
  title: string;
  fileName: string;
  mimeType: string;
  contentBase64: string;
  sizeBytes?: number;
};

function buildEmployeeDocumentStoragePath(
  tenantId: string,
  employeeId: string,
  docId: string,
  fileName: string,
): string {
  return `tenants/${tenantId}/employees/${employeeId}/${docId}/${fileName}`;
}

async function loadExistingFile(tenantId: string, employeeId: string) {
  const cached = getCachedEmployeePersonnelFile(tenantId, employeeId);
  if (cached) return cached;
  const live = await loadEmployeePersonnelFileLive(tenantId, employeeId);
  return live.ok ? live.data : null;
}

async function persistEmployeeRowPatch(
  tenantId: string,
  employeeId: string,
  patch: Record<string, unknown>,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<void>> {
  if (Object.keys(patch).length === 0) {
    return { ok: true, data: undefined };
  }

  if (getServiceMode() === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
    }

    const { error } = await fromUnknownTable(supabase, 'employees')
      .update(patch)
      .eq('tenant_id', tenantId)
      .eq('id', employeeId);

    if (error) {
      return { ok: false, error: toGermanSupabaseError(error) };
    }

    return { ok: true, data: undefined };
  }

  const demoFile = getDemoEmployeePersonnelFile(employeeId);
  if (!demoFile || demoFile.tenantId !== tenantId) {
    return { ok: false, error: 'Mitarbeitende:r nicht gefunden.' };
  }

  if (patch.has_first_aid_certificate !== undefined) {
    const hasFirstAid = patch.has_first_aid_certificate === true;
    if (hasFirstAid) {
      const existing = demoFile.qualifications.find((q) => q.qualificationType === 'first_aid');
      if (!existing) {
        demoFile.qualifications.push({
          id: `${employeeId}-first-aid`,
          tenantId,
          employeeId,
          qualificationType: 'first_aid',
          title: 'Erste Hilfe',
          issuingOrganization: null,
          issuedAt: null,
          validUntil: typeof patch.first_aid_valid_until === 'string' ? patch.first_aid_valid_until : null,
          documentId: null,
          verifiedBy: null,
          verifiedAt: new Date().toISOString(),
          status: 'valid',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    } else {
      demoFile.qualifications = demoFile.qualifications.filter((q) => q.qualificationType !== 'first_aid');
    }
  }

  if (patch.has_police_clearance !== undefined) {
    demoFile.backgroundCheck.present = patch.has_police_clearance === true;
    demoFile.backgroundCheck.status = patch.has_police_clearance ? 'verified' : 'missing';
    if (typeof patch.police_clearance_date === 'string') {
      demoFile.backgroundCheck.issueDate = patch.police_clearance_date;
      demoFile.backgroundCheck.verifiedAt = patch.police_clearance_date;
    }
    if (typeof patch.police_clearance_valid_until === 'string') {
      demoFile.backgroundCheck.followUpDueAt = patch.police_clearance_valid_until;
    }
  }

  demoFile.deployability = evaluateEmployeeDeployability({
    employment: demoFile.employment,
    portalAccess: demoFile.portalAccess,
    qualifications: demoFile.qualifications,
    backgroundCheck: demoFile.backgroundCheck,
    documents: demoFile.documents,
    roleTitle: demoFile.masterData.roleTitle,
    blocked: demoFile.masterData.status === 'gesperrt',
    backgroundCheckRequired: true,
  });

  return { ok: true, data: undefined };
}

export async function updateEmployeeQualificationFlags(
  tenantId: string,
  employeeId: string,
  patch: EmployeeQualificationFlagsPatch,
  actorRoleKey?: RoleKey | null,
) {
  const denied = enforcePermission(actorRoleKey, 'office.employees.edit');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const existing = await loadExistingFile(tenantId, employeeId);
  if (!existing) return { ok: false, error: 'Mitarbeitende:r nicht gefunden.' };

  const updatePayload = buildQualificationFlagsLiveUpdatePayload(patch);
  const saved = await persistEmployeeRowPatch(tenantId, employeeId, updatePayload, actorRoleKey);
  if (!saved.ok) return saved;

  return fetchEmployeePersonnelFile(tenantId, employeeId, actorRoleKey);
}

export async function updateEmployeeBackgroundCheck(
  tenantId: string,
  employeeId: string,
  patch: EmployeeBackgroundCheckPatch,
  actorRoleKey?: RoleKey | null,
) {
  const denied = enforcePermission(actorRoleKey, 'office.employees.edit');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const existing = await loadExistingFile(tenantId, employeeId);
  if (!existing) return { ok: false, error: 'Mitarbeitende:r nicht gefunden.' };

  const updatePayload = buildBackgroundCheckLiveUpdatePayload(patch);
  const saved = await persistEmployeeRowPatch(tenantId, employeeId, updatePayload, actorRoleKey);
  if (!saved.ok) return saved;

  return fetchEmployeePersonnelFile(tenantId, employeeId, actorRoleKey);
}

export async function uploadEmployeePersonnelDocument(
  tenantId: string,
  employeeId: string,
  input: EmployeeDocumentUploadInput,
  actorRoleKey?: RoleKey | null,
  actorProfileId?: string | null,
) {
  const denied = enforcePermission(actorRoleKey, 'office.employees.edit');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const existing = await loadExistingFile(tenantId, employeeId);
  if (!existing) return { ok: false, error: 'Mitarbeitende:r nicht gefunden.' };

  if (getServiceMode() === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
    }

    const docId = crypto.randomUUID?.() ?? `doc-${Date.now()}`;
    const storagePath = buildEmployeeDocumentStoragePath(
      tenantId,
      employeeId,
      docId,
      input.fileName.trim(),
    );
    const payload = Uint8Array.from(atob(input.contentBase64), (c) => c.charCodeAt(0));

    const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(storagePath, payload, {
      contentType: input.mimeType,
      upsert: false,
    });
    if (uploadError) {
      return { ok: false, error: uploadError.message || 'Storage-Upload fehlgeschlagen.' };
    }

    const { error: insertError } = await fromUnknownTable(supabase, 'documents').insert({
      id: docId,
      tenant_id: tenantId,
      employee_id: employeeId,
      title: input.title.trim() || input.fileName.trim(),
      file_name: input.fileName.trim(),
      file_path: storagePath,
      mime_type: input.mimeType,
      file_size_bytes: input.sizeBytes ?? payload.length,
      uploaded_by: actorProfileId ?? null,
      uploaded_at: new Date().toISOString(),
      status: 'active',
      visibility: 'internal_only',
      released_to_employee_portal: false,
    });

    if (insertError) {
      return { ok: false, error: toGermanSupabaseError(insertError) };
    }

    return fetchEmployeePersonnelFile(tenantId, employeeId, actorRoleKey);
  }

  const demoFile = getDemoEmployeePersonnelFile(employeeId);
  if (!demoFile) return { ok: false, error: 'Mitarbeitende:r nicht gefunden.' };

  const now = new Date().toISOString();
  demoFile.documents.unshift({
    id: `doc-${employeeId}-${Date.now()}`,
    tenantId,
    employeeId,
    category: 'other',
    title: input.title.trim() || input.fileName.trim(),
    fileName: input.fileName.trim(),
    storagePath: buildEmployeeDocumentStoragePath(tenantId, employeeId, 'demo', input.fileName.trim()),
    sensitive: false,
    releasedToPortal: false,
    validUntil: null,
    createdAt: now,
    updatedAt: now,
  });

  demoFile.deployability = evaluateEmployeeDeployability({
    employment: demoFile.employment,
    portalAccess: demoFile.portalAccess,
    qualifications: demoFile.qualifications,
    backgroundCheck: demoFile.backgroundCheck,
    documents: demoFile.documents,
    roleTitle: demoFile.masterData.roleTitle,
    blocked: demoFile.masterData.status === 'gesperrt',
    backgroundCheckRequired: true,
  });

  return fetchEmployeePersonnelFile(tenantId, employeeId, actorRoleKey);
}
