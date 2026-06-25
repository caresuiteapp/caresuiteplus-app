import type { RoleKey, ServiceResult } from '@/types';
import type {
  EmployeeMasterData,
  EmployeePersonnelFile,
  EmployeePersonnelOverview,
} from '@/types/modules/employeePersonnelFile';
import { getDemoEmployeePersonnelFile } from '@/data/demo/employeePersonnelFile';
import { enforcePermission } from '@/lib/permissions';
import { isEmployeePortalRole } from '@/lib/permissions/workspaceRoles';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { runService } from '@/lib/services/serviceRunner';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import {
  getCachedEmployeePersonnelFile,
  loadEmployeePersonnelFileLive,
} from './employeePersonnelFileLiveLoader';
import { buildMasterDataLiveUpdatePayload } from './employeePersonnelFileMapper';
import { computeBackgroundCheckStatus } from './employeeBackgroundCheckService';
import {
  buildDeployabilityOpenTasks,
  evaluateEmployeeDeployability,
} from './employeeDeployabilityService';
import { ALL_EMPLOYEE_PERSONNEL_TABS } from './employeePersonnelFieldRules';
import {
  auditEmployeeMasterDataChange,
  getEmployeeAuditEvents,
} from './employeePersonnelAuditService';
import {
  buildPersonnelAccessContext,
  canViewEmployeePersonnelFile,
  filterPersonnelFileForPortal,
} from './employeePersonnelAccess';
import { validateEmployeeMasterData } from './employeeMasterDataValidation';
import {
  findNextQualificationExpiry,
  resolveQualificationOverview,
} from './employeeQualificationService';
import { findBackgroundCheckFollowUp } from './employeeBackgroundCheckService';

export function buildEmployeePersonnelOverview(file: EmployeePersonnelFile): EmployeePersonnelOverview {
  const nextExpiryDates: EmployeePersonnelOverview['nextExpiryDates'] = [];

  const qualExpiry = findNextQualificationExpiry(file.qualifications);
  if (qualExpiry) {
    nextExpiryDates.push({ ...qualExpiry, type: 'qualification' });
  }

  const bgFollowUp = findBackgroundCheckFollowUp(file.backgroundCheck);
  if (bgFollowUp) {
    nextExpiryDates.push({ ...bgFollowUp, type: 'background_check' });
  }

  for (const doc of file.documents) {
    if (doc.validUntil) {
      nextExpiryDates.push({ label: doc.title, date: doc.validUntil, type: 'document' });
    }
  }

  nextExpiryDates.sort((a, b) => a.date.localeCompare(b.date));

  return {
    employeeId: file.employeeId,
    tenantId: file.tenantId,
    fullName: `${file.masterData.firstName} ${file.masterData.lastName}`.trim(),
    roleTitle: file.masterData.roleTitle,
    employmentStatus: file.employment.employmentStatus,
    portalActive: file.portalAccess.portalActive,
    qualificationStatus: resolveQualificationOverview(file.qualifications),
    backgroundCheckStatus: computeBackgroundCheckStatus(file.backgroundCheck),
    deployability: file.deployability.result,
    openTasks: buildDeployabilityOpenTasks(file.deployability),
    nextExpiryDates: nextExpiryDates.slice(0, 5),
  };
}

export async function fetchEmployeePersonnelFile(
  tenantId: string,
  employeeId: string,
  actorRoleKey?: RoleKey | null,
  workspaceContext?: { userId?: string | null; employeeId?: string | null },
): Promise<ServiceResult<EmployeePersonnelFile>> {
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const accessCtx = buildPersonnelAccessContext({
    tenantId,
    roleKey: actorRoleKey ?? null,
    userId: workspaceContext?.userId,
    employeeId: workspaceContext?.employeeId,
    targetEmployeeId: employeeId,
  });

  const access = canViewEmployeePersonnelFile(accessCtx);
  if (!access.allowed) return { ok: false, error: access.reason ?? 'Kein Zugriff.' };

  if (!isEmployeePortalRole(actorRoleKey ?? null) && actorRoleKey !== 'employee_portal') {
    const denied = enforcePermission<EmployeePersonnelFile>(actorRoleKey, 'office.employees.view');
    if (denied) return denied;
  }

  if (getServiceMode() === 'supabase') {
    const liveResult = await loadEmployeePersonnelFileLive(tenantId, employeeId);
    if (!liveResult.ok) return liveResult;

    const enriched: EmployeePersonnelFile = {
      ...liveResult.data,
      auditEvents: getEmployeeAuditEvents(employeeId),
      tabs: ALL_EMPLOYEE_PERSONNEL_TABS,
    };

    return { ok: true, data: filterPersonnelFileForPortal(enriched, accessCtx) };
  }

  return runService(async () => {
    const file = getDemoEmployeePersonnelFile(employeeId);
    if (!file) return { ok: false, error: 'Mitarbeitende:r nicht gefunden.' };
    if (file.tenantId !== tenantId) {
      return { ok: false, error: 'Kein mandantenübergreifender Zugriff auf Personalakten.' };
    }

    const auditEvents = getEmployeeAuditEvents(employeeId);
    const enriched: EmployeePersonnelFile = {
      ...file,
      auditEvents,
      tabs: ALL_EMPLOYEE_PERSONNEL_TABS,
    };

    return { ok: true, data: filterPersonnelFileForPortal(enriched, accessCtx) };
  }, { delayMs: 220 });
}

export async function fetchEmployeePersonnelOverview(
  tenantId: string,
  employeeId: string,
  actorRoleKey?: RoleKey | null,
  workspaceContext?: { userId?: string | null; employeeId?: string | null },
): Promise<ServiceResult<EmployeePersonnelOverview>> {
  const fileResult = await fetchEmployeePersonnelFile(
    tenantId,
    employeeId,
    actorRoleKey,
    workspaceContext,
  );
  if (!fileResult.ok) return fileResult;
  return { ok: true, data: buildEmployeePersonnelOverview(fileResult.data) };
}

export async function updateEmployeeMasterData(
  tenantId: string,
  employeeId: string,
  patch: Partial<EmployeeMasterData>,
  actorRoleKey?: RoleKey | null,
  actorId?: string | null,
): Promise<ServiceResult<EmployeePersonnelFile>> {
  const denied = enforcePermission<EmployeePersonnelFile>(actorRoleKey, 'office.employees.edit');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const cached = getCachedEmployeePersonnelFile(tenantId, employeeId);
  const demoFile = getDemoEmployeePersonnelFile(employeeId);
  const existingFile =
    getServiceMode() === 'supabase'
    ? cached ?? await loadEmployeePersonnelFileLive(tenantId, employeeId).then(r => r.ok ? r.data : null)
    : demoFile;

  if (!existingFile) return { ok: false, error: 'Mitarbeitende:r nicht gefunden.' };
  if (existingFile.tenantId !== tenantId) {
    return { ok: false, error: 'Kein mandantenübergreifender Zugriff auf Personalakten.' };
  }

  const before = { ...existingFile.masterData };
  const after = { ...existingFile.masterData, ...patch };
  const errors = validateEmployeeMasterData(after, tenantId);
  if (Object.keys(errors).length > 0) {
    return { ok: false, error: Object.values(errors)[0] ?? 'Validierungsfehler.' };
  }

  if (getServiceMode() === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { ok: false, error: 'Supabase ist nicht verfügbar.' };
    }

    const updatePayload = buildMasterDataLiveUpdatePayload(patch);
    if (Object.keys(updatePayload).length > 0) {
      const { error } = await fromUnknownTable(supabase, 'employees')
        .update(updatePayload)
        .eq('tenant_id', tenantId)
        .eq('id', employeeId);

      if (error) {
        return { ok: false, error: toGermanSupabaseError(error) };
      }
    }

    auditEmployeeMasterDataChange({
      tenantId,
      employeeId,
      actorId: actorId ?? null,
      actorRole: actorRoleKey ?? null,
      before,
      after,
    });

    return fetchEmployeePersonnelFile(tenantId, employeeId, actorRoleKey);
  }

  if (!demoFile) return { ok: false, error: 'Mitarbeitende:r nicht gefunden.' };

  demoFile.masterData = after;
  auditEmployeeMasterDataChange({
    tenantId,
    employeeId,
    actorId: actorId ?? null,
    actorRole: actorRoleKey ?? null,
    before,
    after,
  });

  demoFile.deployability = evaluateEmployeeDeployability({
    employment: demoFile.employment,
    portalAccess: demoFile.portalAccess,
    qualifications: demoFile.qualifications,
    backgroundCheck: demoFile.backgroundCheck,
    documents: demoFile.documents,
    roleTitle: demoFile.masterData.roleTitle,
    blocked: after.status === 'gesperrt',
    backgroundCheckRequired: true,
  });

  return fetchEmployeePersonnelFile(tenantId, employeeId, actorRoleKey);
}

export function getEmployeePersonnelFileForAssignmentCheck(
  tenantId: string,
  employeeId: string,
): EmployeePersonnelFile | null {
  if (getServiceMode() === 'supabase') {
    const cached = getCachedEmployeePersonnelFile(tenantId, employeeId);
    if (cached) return cached;
    return null;
  }

  const file = getDemoEmployeePersonnelFile(employeeId);
  if (!file || file.tenantId !== tenantId) return null;
  return file;
}
