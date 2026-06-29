import type { RoleKey, ServiceResult } from '@/types';
import type { PermissionKey } from '@/types/permissions';
import type { EmployeeDataScope, EmployeePermissionOverride } from '@/types/permissions/rbac';
import { getDemoEmployeePersonnelFile } from '@/data/demo/employeePersonnelFile';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { updateProfileRoleKey } from '@/lib/supabase/profileRoleBridge';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { buildStorageObjectFileName, buildTenantStoragePath, toStorageUploadError } from '@/lib/storage/storagePaths';
import {
  buildBackgroundCheckLiveUpdatePayload,
  buildEmploymentLiveUpdatePayload,
  buildMasterDataLiveUpdatePayload,
  buildQualificationFlagsLiveUpdatePayload,
  type EmployeeBackgroundCheckPatch,
  type EmployeeEmploymentPatch,
  type EmployeeQualificationFlagsPatch,
} from './employeePersonnelFileMapper';
import type { EmployeeMasterData } from '@/types/modules/employeePersonnelFile';
import { evaluateEmployeeDeployability } from './employeeDeployabilityService';
import {
  persistEmployeeHomeOfficeOverride,
  getEmployeeHomeOfficeOverride,
  persistEmployeeTimeTrackingModeOverride,
  type EmployeeTimeTrackingMode,
} from './employeeHomeOfficeService';
import { setEmployeeRoleAssignments, writePermissionAuditLog } from '@/lib/permissions/rbacService';
import { saveEmployeeRbacState } from '@/lib/office/employeeRbacSaveService';
import { fetchPermissionCatalog } from '@/lib/permissions/permissionCatalogService';
import { appendEmployeeAuditEvent } from './employeePersonnelAuditService';
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
  const storageFileName = buildStorageObjectFileName(docId, fileName);
  return buildTenantStoragePath(tenantId, 'employees', employeeId, docId, storageFileName);
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

    const employeePatch: Record<string, unknown> = {};
    const backgroundPatch: Record<string, unknown> = {};
    const qualificationPatch: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(patch)) {
      if (key.startsWith('has_police_clearance') || key.startsWith('police_clearance_')) {
        backgroundPatch[key] = value;
      } else if (
        key.startsWith('has_first_aid') ||
        key.startsWith('first_aid_') ||
        key.startsWith('has_driver_license') ||
        key.startsWith('driver_license_') ||
        key === 'qualification'
      ) {
        qualificationPatch[key] = value;
      } else {
        employeePatch[key] = value;
      }
    }

    if (Object.keys(employeePatch).length > 0) {
      const { error } = await fromUnknownTable(supabase, 'employees')
        .update(employeePatch)
        .eq('tenant_id', tenantId)
        .eq('id', employeeId);

      if (error) {
        return { ok: false, error: toGermanSupabaseError(error) };
      }
    }

    if (Object.keys(backgroundPatch).length > 0) {
      const hasClearance = backgroundPatch.has_police_clearance === true;
      const { error } = await fromUnknownTable(supabase, 'employee_background_checks').upsert(
        {
          tenant_id: tenantId,
          employee_id: employeeId,
          present: hasClearance,
          issue_date: backgroundPatch.police_clearance_date ?? null,
          follow_up_due_at: backgroundPatch.police_clearance_valid_until ?? null,
          verified_at: hasClearance ? backgroundPatch.police_clearance_date ?? new Date().toISOString() : null,
          status: hasClearance ? 'verified' : 'missing',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id,employee_id' },
      );

      if (error) {
        const fallback = await fromUnknownTable(supabase, 'employees')
          .update(backgroundPatch)
          .eq('tenant_id', tenantId)
          .eq('id', employeeId);
        if (fallback.error) {
          return { ok: false, error: toGermanSupabaseError(fallback.error) };
        }
      }
    }

    if (Object.keys(qualificationPatch).length > 0) {
      const fallback = await fromUnknownTable(supabase, 'employees')
        .update(qualificationPatch)
        .eq('tenant_id', tenantId)
        .eq('id', employeeId);
      if (fallback.error) {
        return { ok: false, error: toGermanSupabaseError(fallback.error) };
      }
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

  if (patch.employment_type !== undefined) {
    demoFile.employment.contractType =
      typeof patch.employment_type === 'string' ? patch.employment_type : null;
  }
  if (patch.weekly_hours !== undefined) {
    const hours = typeof patch.weekly_hours === 'number' ? patch.weekly_hours : null;
    demoFile.employment.weeklyHours = hours;
    demoFile.masterData.weeklyHours = hours;
  }
  if (patch.entry_date !== undefined) {
    demoFile.masterData.entryDate = typeof patch.entry_date === 'string' ? patch.entry_date : null;
  }
  if (patch.street !== undefined) {
    demoFile.masterData.street = typeof patch.street === 'string' ? patch.street : null;
  }
  if (patch.house_number !== undefined) {
    demoFile.masterData.houseNumber = typeof patch.house_number === 'string' ? patch.house_number : null;
  }
  if (patch.postal_code !== undefined) {
    demoFile.masterData.postalCode = typeof patch.postal_code === 'string' ? patch.postal_code : null;
  }
  if (patch.city !== undefined) {
    demoFile.masterData.city = typeof patch.city === 'string' ? patch.city : null;
  }
  if (patch.country !== undefined) {
    demoFile.masterData.country = typeof patch.country === 'string' ? patch.country : null;
  }
  if (patch.date_of_birth !== undefined) {
    demoFile.masterData.dateOfBirth = typeof patch.date_of_birth === 'string' ? patch.date_of_birth : null;
  }

  if (patch.status !== undefined && typeof patch.status === 'string') {
    const dbStatus = patch.status;
    const statusMap: Record<string, typeof demoFile.employment.employmentStatus> = {
      draft: 'onboarding',
      active: 'active',
      inactive: 'archived',
      sick: 'sick_long_term',
      vacation: 'on_leave',
      blocked: 'suspended',
      terminated: 'terminated',
    };
    demoFile.employment.employmentStatus = statusMap[dbStatus] ?? 'active';
    const catalogMap: Record<string, string> = {
      draft: 'entwurf',
      active: 'aktiv',
      inactive: 'archiviert',
      sick: 'krank',
      vacation: 'urlaub',
      blocked: 'gesperrt',
      terminated: 'ausgeschieden',
    };
    demoFile.masterData.status = catalogMap[dbStatus] ?? 'aktiv';
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

export async function updateEmployeeMasterData(
  tenantId: string,
  employeeId: string,
  patch: Partial<EmployeeMasterData>,
  actorRoleKey?: RoleKey | null,
  actorProfileId?: string | null,
) {
  const denied = enforcePermission(actorRoleKey, 'office.employees.edit');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const existing = await loadExistingFile(tenantId, employeeId);
  if (!existing) return { ok: false, error: 'Mitarbeitende:r nicht gefunden.' };

  const updatePayload = buildMasterDataLiveUpdatePayload(patch);
  const saved = await persistEmployeeRowPatch(tenantId, employeeId, updatePayload, actorRoleKey);
  if (!saved.ok) return saved;

  await appendEmployeeAuditEvent({
    tenantId,
    employeeId,
    action: 'master_data_updated',
    actorId: actorProfileId ?? null,
    actorRole: actorRoleKey ?? null,
    summary: 'Stammdaten aktualisiert.',
  });

  return fetchEmployeePersonnelFile(tenantId, employeeId, actorRoleKey);
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

export async function updateEmployeeEmployment(
  tenantId: string,
  employeeId: string,
  patch: EmployeeEmploymentPatch,
  actorRoleKey?: RoleKey | null,
) {
  const denied = enforcePermission(actorRoleKey, 'office.employees.edit');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const existing = await loadExistingFile(tenantId, employeeId);
  if (!existing) return { ok: false, error: 'Mitarbeitende:r nicht gefunden.' };

  if (patch.weeklyHours != null && (patch.weeklyHours < 0 || patch.weeklyHours > 60)) {
    return { ok: false, error: 'Wochenstunden zwischen 0 und 60.' };
  }

  const updatePayload = buildEmploymentLiveUpdatePayload(patch);
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
      return { ok: false, error: toStorageUploadError(uploadError.message) };
    }

    const { error: insertError } = await fromUnknownTable(supabase, 'employee_documents').insert({
      id: docId,
      tenant_id: tenantId,
      employee_id: employeeId,
      category: 'other',
      title: input.title.trim() || input.fileName.trim(),
      file_name: input.fileName.trim(),
      storage_path: storagePath,
      sensitive: false,
      released_to_portal: false,
    });

    if (insertError) {
      const legacyInsert = await fromUnknownTable(supabase, 'documents').insert({
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
        visibility: 'internal',
        released_to_employee_portal: false,
      });
      if (legacyInsert.error) {
        return { ok: false, error: toGermanSupabaseError(legacyInsert.error) };
      }
    }

    await appendEmployeeAuditEvent({
      tenantId,
      employeeId,
      action: 'document_uploaded',
      actorId: actorProfileId ?? null,
      actorRole: actorRoleKey ?? null,
      summary: `Dokument „${input.title.trim() || input.fileName.trim()}“ hochgeladen.`,
    });

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

export type EmployeeRolesPermissionsPatch = {
  roleKey: RoleKey;
  additionalRoleKeys?: RoleKey[];
  homeOfficeEnabled?: boolean | null;
  timeTrackingMode?: EmployeeTimeTrackingMode | null;
  desiredPermissions?: PermissionKey[];
  overrides?: EmployeePermissionOverride[];
  dataScopes?: EmployeeDataScope[];
  changeReason?: string | null;
};

export async function updateEmployeeRolesPermissions(
  tenantId: string,
  employeeId: string,
  patch: EmployeeRolesPermissionsPatch,
  actorRoleKey?: RoleKey | null,
  actorProfileId?: string | null,
) {
  const denied = enforcePermission(actorRoleKey, 'office.employees.edit');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const existing = await loadExistingFile(tenantId, employeeId);
  if (!existing) return { ok: false, error: 'Mitarbeitende:r nicht gefunden.' };

  const previousHomeOffice = getEmployeeHomeOfficeOverride(employeeId, tenantId);

  if (patch.homeOfficeEnabled !== undefined) {
    const savedHomeOffice = await persistEmployeeHomeOfficeOverride(
      tenantId,
      employeeId,
      patch.homeOfficeEnabled,
    );
    if (!savedHomeOffice.ok) return savedHomeOffice;
  }

  if (patch.timeTrackingMode !== undefined) {
    const savedMode = await persistEmployeeTimeTrackingModeOverride(
      tenantId,
      employeeId,
      patch.timeTrackingMode,
    );
    if (!savedMode.ok) return savedMode;
  }

  const allRoleKeys = [
    patch.roleKey,
    ...(patch.additionalRoleKeys ?? []).filter((k) => k !== patch.roleKey),
  ];

  const assignmentResult = await setEmployeeRoleAssignments(
    tenantId,
    employeeId,
    allRoleKeys,
    patch.roleKey,
  );
  if (!assignmentResult.ok) return assignmentResult;

  if (
    patch.desiredPermissions ||
    patch.overrides ||
    patch.dataScopes ||
    patch.changeReason
  ) {
    const catalogResult = await fetchPermissionCatalog();
    const catalog = catalogResult.ok ? catalogResult.data : [];
    const rbacResult = await saveEmployeeRbacState(
      tenantId,
      employeeId,
      {
        roleKey: patch.roleKey,
        additionalRoleKeys: patch.additionalRoleKeys,
        desiredPermissions: patch.desiredPermissions,
        overrides: patch.overrides,
        dataScopes: patch.dataScopes,
        changeReason: patch.changeReason,
      },
      catalog,
      actorRoleKey,
      actorProfileId,
    );
    if (!rbacResult.ok) return rbacResult;
  }

  if (getServiceMode() === 'supabase') {
    if (existing.portalAccess.profileId) {
      const profileRoleResult = await updateProfileRoleKey(
        tenantId,
        existing.portalAccess.profileId,
        patch.roleKey,
      );
      if (!profileRoleResult.ok) return profileRoleResult;
    }
  } else {
    const demoFile = getDemoEmployeePersonnelFile(employeeId);
    if (demoFile) {
      demoFile.portalAccess.roleKey = patch.roleKey;
    }
  }

  const fieldChanges: Record<string, { before: string | null; after: string | null }> = {
    roleKey: {
      before: existing.portalAccess.roleKey,
      after: patch.roleKey,
    },
  };

  if (patch.homeOfficeEnabled !== undefined) {
    fieldChanges.homeOfficeEnabled = {
      before: previousHomeOffice == null ? null : String(previousHomeOffice),
      after: patch.homeOfficeEnabled == null ? null : String(patch.homeOfficeEnabled),
    };
  }

  if (patch.additionalRoleKeys) {
    fieldChanges.additionalRoleKeys = {
      before: null,
      after: patch.additionalRoleKeys.join(','),
    };
  }

  if (patch.timeTrackingMode !== undefined) {
    fieldChanges.timeTrackingMode = {
      before: null,
      after: patch.timeTrackingMode ?? null,
    };
  }

  await writePermissionAuditLog({
    tenantId,
    actorId: actorProfileId ?? null,
    actorRole: actorRoleKey ?? null,
    targetEmployeeId: employeeId,
    targetRoleTemplateId: null,
    action: 'employee_roles_updated',
    oldValue: { roleKey: existing.portalAccess.roleKey },
    newValue: {
      roleKey: patch.roleKey,
      additionalRoleKeys: patch.additionalRoleKeys,
      timeTrackingMode: patch.timeTrackingMode,
    },
    reason: null,
    ipAddress: null,
  });

  await appendEmployeeAuditEvent({
    tenantId,
    employeeId,
    action: 'roles_permissions_updated',
    actorId: actorProfileId ?? null,
    actorRole: actorRoleKey ?? null,
    summary: `Rolle geändert auf ${patch.roleKey}.`,
    fieldChanges,
  });

  return fetchEmployeePersonnelFile(tenantId, employeeId, actorRoleKey);
}

export async function deleteEmployeePersonnelDocument(
  tenantId: string,
  employeeId: string,
  documentId: string,
  actorRoleKey?: RoleKey | null,
  actorProfileId?: string | null,
) {
  const denied = enforcePermission(actorRoleKey, 'office.employees.edit');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const existing = await loadExistingFile(tenantId, employeeId);
  if (!existing) return { ok: false, error: 'Mitarbeitende:r nicht gefunden.' };

  const doc = existing.documents.find((item) => item.id === documentId);
  if (!doc) return { ok: false, error: 'Dokument nicht gefunden.' };

  if (getServiceMode() === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
    }

    if (doc.storagePath) {
      await supabase.storage.from(STORAGE_BUCKET).remove([doc.storagePath]);
    }

    const { error: employeeDocError } = await fromUnknownTable(supabase, 'employee_documents')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .eq('id', documentId);

    if (employeeDocError) {
      const { error: legacyError } = await fromUnknownTable(supabase, 'documents')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('employee_id', employeeId)
        .eq('id', documentId);

      if (legacyError) {
        return { ok: false, error: toGermanSupabaseError(legacyError) };
      }
    }
  } else {
    const demoFile = getDemoEmployeePersonnelFile(employeeId);
    if (!demoFile) return { ok: false, error: 'Mitarbeitende:r nicht gefunden.' };
    demoFile.documents = demoFile.documents.filter((item) => item.id !== documentId);
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
  }

  await appendEmployeeAuditEvent({
    tenantId,
    employeeId,
    action: 'document_deleted',
    actorId: actorProfileId ?? null,
    actorRole: actorRoleKey ?? null,
    summary: `Dokument „${doc.title}“ gelöscht.`,
  });

  return fetchEmployeePersonnelFile(tenantId, employeeId, actorRoleKey);
}
