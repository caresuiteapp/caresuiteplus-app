import type { RoleKey, ServiceResult } from '@/types';
import type {
  EmployeeMasterData,
  EmployeePersonnelFile,
  EmployeePersonnelOverview,
} from '@/types/modules/employeePersonnelFile';
import { getDemoEmployeePersonnelFile } from '@/data/demo/employeePersonnelFile';
import { enforcePermission } from '@/lib/permissions';
import { isEmployeePortalRole } from '@/lib/permissions/workspaceRoles';
import { guardLiveDemoFeature, guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { runService } from '@/lib/services/serviceRunner';
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
    const liveBlock = guardLiveDemoFeature<EmployeePersonnelFile>(tenantId, 'Personalakte');
    if (liveBlock) return liveBlock;
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

  if (getServiceMode() === 'supabase') {
    const liveBlock = guardLiveDemoFeature<EmployeePersonnelFile>(tenantId, 'Personalakte');
    if (liveBlock) return liveBlock;
  }

  const file = getDemoEmployeePersonnelFile(employeeId);
  if (!file) return { ok: false, error: 'Mitarbeitende:r nicht gefunden.' };
  if (file.tenantId !== tenantId) {
    return { ok: false, error: 'Kein mandantenübergreifender Zugriff auf Personalakten.' };
  }

  const before = { ...file.masterData };
  const after = { ...file.masterData, ...patch };
  const errors = validateEmployeeMasterData(after, tenantId);
  if (Object.keys(errors).length > 0) {
    return { ok: false, error: Object.values(errors)[0] ?? 'Validierungsfehler.' };
  }

  file.masterData = after;
  auditEmployeeMasterDataChange({
    tenantId,
    employeeId,
    actorId: actorId ?? null,
    actorRole: actorRoleKey ?? null,
    before,
    after,
  });

  file.deployability = evaluateEmployeeDeployability({
    employment: file.employment,
    portalAccess: file.portalAccess,
    qualifications: file.qualifications,
    backgroundCheck: file.backgroundCheck,
    documents: file.documents,
    roleTitle: file.masterData.roleTitle,
    blocked: after.status === 'gesperrt',
    backgroundCheckRequired: true,
  });

  return fetchEmployeePersonnelFile(tenantId, employeeId, actorRoleKey);
}

export function getEmployeePersonnelFileForAssignmentCheck(
  tenantId: string,
  employeeId: string,
): EmployeePersonnelFile | null {
  const file = getDemoEmployeePersonnelFile(employeeId);
  if (!file || file.tenantId !== tenantId) return null;
  return file;
}
