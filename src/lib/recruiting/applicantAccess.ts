import type { RoleKey } from '@/types/core/auth';
import type { ApplicantRecord } from '@/types/modules/recruiting';
import { hasPermission } from '@/lib/permissions';
import { isClientPortalRole, isEmployeePortalRole } from '@/lib/permissions/workspaceRoles';

/** Regel 3/4 — Keine sensiblen Bewerbungsdaten für unautorisierte Rollen / Klient:innen */
export function canViewApplicantList(roleKey: RoleKey | null | undefined): boolean {
  if (!roleKey || isClientPortalRole(roleKey) || isEmployeePortalRole(roleKey)) return false;
  return hasPermission(roleKey, 'office.recruiting.view');
}

export function canManageApplicants(roleKey: RoleKey | null | undefined): boolean {
  if (!roleKey) return false;
  return hasPermission(roleKey, 'office.recruiting.manage');
}

export function canViewSensitiveApplicantData(roleKey: RoleKey | null | undefined): boolean {
  if (!roleKey) return false;
  return hasPermission(roleKey, 'office.recruiting.view_sensitive');
}

export function canConvertApplicantToEmployee(roleKey: RoleKey | null | undefined): boolean {
  if (!roleKey) return false;
  return (
    hasPermission(roleKey, 'office.recruiting.convert') ||
    hasPermission(roleKey, 'office.employees.create')
  );
}

export function canManageEmployeeOnboarding(roleKey: RoleKey | null | undefined): boolean {
  if (!roleKey) return false;
  return hasPermission(roleKey, 'office.recruiting.onboarding.manage');
}

export function assertApplicantTenantScope(
  recordTenantId: string,
  requestTenantId: string,
): { ok: false; reason: string } | null {
  if (recordTenantId !== requestTenantId) {
    return { ok: false, reason: 'Kein mandantenübergreifender Zugriff auf Bewerbungen.' };
  }
  return null;
}

/** Regel 2 — Bewerber sind nicht einsatzplanbar */
export function isApplicantAssignable(_applicant: ApplicantRecord): {
  assignable: false;
  reason: string;
} {
  return {
    assignable: false,
    reason: 'Bewerber:innen sind nicht einsatzplanbar — Umwandlung in Mitarbeitenden-Datensatz erforderlich.',
  };
}

export type ApplicantPublicView = Pick<
  ApplicantRecord,
  | 'id'
  | 'tenantId'
  | 'firstName'
  | 'lastName'
  | 'appliedRole'
  | 'status'
  | 'appliedAt'
  | 'currentProcessStep'
>;

export type ApplicantSensitiveView = ApplicantRecord;

export function filterApplicantForViewer(
  applicant: ApplicantRecord,
  roleKey: RoleKey | null | undefined,
): ApplicantPublicView | ApplicantSensitiveView {
  if (canViewSensitiveApplicantData(roleKey)) return applicant;
  return {
    id: applicant.id,
    tenantId: applicant.tenantId,
    firstName: applicant.firstName,
    lastName: applicant.lastName,
    appliedRole: applicant.appliedRole,
    status: applicant.status,
    appliedAt: applicant.appliedAt,
    currentProcessStep: applicant.currentProcessStep,
  };
}

export function resolveRecruitingViewsForRole(roleKey: RoleKey | null | undefined): string[] {
  if (!canViewApplicantList(roleKey)) return [];
  const views = ['dashboard', 'applicant_list', 'onboarding_list'];
  if (canManageApplicants(roleKey)) {
    views.push(
      'applicant_detail',
      'documents',
      'interviews',
      'communications',
      'offer_decision',
      'conversion',
    );
  }
  if (canManageEmployeeOnboarding(roleKey)) {
    views.push('onboarding_detail');
  }
  if (canViewSensitiveApplicantData(roleKey)) {
    views.push('privacy');
  }
  return views;
}
