import type { RoleKey } from '@/types/core/auth';
import type {
  EmployeeBackgroundCheckRecord,
  EmployeeDeployabilityCheck,
  EmployeeDeployabilityIssue,
  EmployeeDeployabilityResult,
  EmployeeDocumentRecord,
  EmployeeEmploymentDetails,
  EmployeePortalAccessRecord,
  EmployeeQualificationRecord,
  EmployeeQualificationStatus,
} from '@/types/modules/employeePersonnelFile';
import { computeBackgroundCheckStatus } from './employeeBackgroundCheckService';
import {
  ASSIGNABLE_EMPLOYMENT_STATUSES,
  getRequiredQualificationsForRole,
  INACTIVE_EMPLOYMENT_STATUSES,
  PORTAL_RELEASED_DOCUMENT_CATEGORIES,
} from './employeePersonnelFieldRules';
import {
  computeQualificationStatus,
  hasRequiredQualifications,
  resolveQualificationOverview,
} from './employeeQualificationService';
import { labelQualificationType } from './employeePersonnelLabels';
import { evaluateComplianceDeployability } from './complianceTrainingService';

export type EvaluateEmployeeDeployabilityInput = {
  employment: EmployeeEmploymentDetails;
  portalAccess: EmployeePortalAccessRecord;
  qualifications: EmployeeQualificationRecord[];
  backgroundCheck: EmployeeBackgroundCheckRecord;
  documents: EmployeeDocumentRecord[];
  roleTitle?: string | null;
  roleKey?: RoleKey | null;
  tenantId?: string;
  employeeId?: string;
  blocked?: boolean;
  absent?: boolean;
  availabilityOk?: boolean;
  backgroundCheckRequired?: boolean;
  portalRequired?: boolean;
  reference?: Date;
};

export function evaluateEmployeeDeployability(
  input: EvaluateEmployeeDeployabilityInput,
): EmployeeDeployabilityCheck {
  const reference = input.reference ?? new Date();
  const blockers: EmployeeDeployabilityIssue[] = [];
  const warnings: EmployeeDeployabilityIssue[] = [];

  const active = ASSIGNABLE_EMPLOYMENT_STATUSES.has(input.employment.employmentStatus);
  if (!active || INACTIVE_EMPLOYMENT_STATUSES.has(input.employment.employmentStatus)) {
    blockers.push({
      code: 'employment_inactive',
      message: 'Mitarbeitende:r ist nicht einsatzfähig (Anstellungsstatus).',
      severity: 'error',
    });
  }

  if (input.blocked) {
    blockers.push({
      code: 'employee_blocked',
      message: 'Mitarbeitende:r ist gesperrt.',
      severity: 'error',
    });
  }

  if (input.absent) {
    blockers.push({
      code: 'employee_absent',
      message: 'Mitarbeitende:r ist abwesend.',
      severity: 'error',
    });
  }

  const requiredTypes = getRequiredQualificationsForRole(input.roleTitle ?? null);
  const qualCheck = hasRequiredQualifications(input.qualifications, requiredTypes, reference);
  if (!qualCheck.ok) {
    for (const missing of qualCheck.missing) {
      warnings.push({
        code: 'qualification_missing',
        message: `Pflichtqualifikation fehlt: ${labelQualificationType(missing)}`,
        severity: 'warning',
      });
    }
  }

  for (const qualification of input.qualifications) {
    const status = computeQualificationStatus(qualification, reference);
    if (status === 'expires_soon') {
      warnings.push({
        code: 'qualification_expires_soon',
        message: `Qualifikation läuft bald ab: ${qualification.title}`,
        severity: 'warning',
      });
    }
    if (status === 'pending_review') {
      warnings.push({
        code: 'qualification_unverified',
        message: `Qualifikation nicht verifiziert: ${qualification.title}`,
        severity: 'warning',
      });
    }
  }

  const bgStatus = computeBackgroundCheckStatus(input.backgroundCheck);
  const backgroundCheckOk =
    !input.backgroundCheckRequired ||
    bgStatus === 'verified' ||
    (bgStatus !== 'missing' && bgStatus !== 'expired' && bgStatus !== 'rejected');

  if (input.backgroundCheckRequired && !backgroundCheckOk) {
    warnings.push({
      code: 'background_check_missing',
      message: 'Führungszeugnis fehlt, abgelaufen oder nicht verifiziert.',
      severity: 'warning',
    });
  } else if (bgStatus === 'requested' || bgStatus === 'submitted') {
    warnings.push({
      code: 'background_check_follow_up',
      message: 'Führungszeugnis-Nachweis prüfen oder erneuern.',
      severity: 'warning',
    });
  }

  const portalOk = !input.portalRequired || input.portalAccess.portalActive;
  if (input.portalRequired && !input.portalAccess.portalActive) {
    blockers.push({
      code: 'portal_inactive',
      message: 'Portalzugang nicht aktiv.',
      severity: 'error',
    });
  } else if (!input.portalAccess.portalActive) {
    warnings.push({
      code: 'portal_inactive',
      message: 'Portalzugang nicht aktiv.',
      severity: 'warning',
    });
  }

  const requiredDocCategories = ['contract', 'privacy'] as const;
  const requiredDocsOk = requiredDocCategories.every((category) =>
    input.documents.some((doc) => doc.category === category),
  );
  if (!requiredDocsOk) {
    warnings.push({
      code: 'required_docs_missing',
      message: 'Pflichtdokumente (Vertrag/Datenschutz) fehlen.',
      severity: 'warning',
    });
  }

  const releasedDocs = input.documents.filter((doc) =>
    PORTAL_RELEASED_DOCUMENT_CATEGORIES.has(doc.category),
  );
  if (releasedDocs.length === 0 && input.documents.length > 0) {
    warnings.push({
      code: 'portal_docs_limited',
      message: 'Keine für das Portal freigegebenen Dokumente.',
      severity: 'warning',
    });
  }

  const availabilityOk = input.availabilityOk !== false;
  if (!availabilityOk) {
    warnings.push({
      code: 'outside_availability',
      message: 'Verfügbarkeit eingeschränkt.',
      severity: 'warning',
    });
  }

  if (input.tenantId && input.employeeId) {
    const compliance = evaluateComplianceDeployability(
      input.tenantId,
      input.employeeId,
      input.roleKey ?? input.portalAccess.roleKey,
      reference,
    );
    if (!compliance.ok) {
      for (const message of compliance.blockers) {
        warnings.push({
          code: 'compliance_training_missing',
          message,
          severity: 'warning',
        });
      }
    }
  }

  const qualificationOverview = resolveQualificationOverview(input.qualifications, reference);
  const qualificationOk = qualCheck.ok && qualificationOverview !== 'expired';

  const result: EmployeeDeployabilityResult =
    blockers.length > 0 ? 'blocked' : warnings.length > 0 ? 'warning' : 'assignable';

  return {
    result,
    active,
    portalOk,
    qualificationOk,
    notAbsent: !input.absent,
    backgroundCheckOk,
    availabilityOk,
    noBlock: !input.blocked,
    requiredDocsOk,
    warnings,
    blockers,
  };
}

export function isEmployeeAssignable(deployability: EmployeeDeployabilityCheck): boolean {
  return deployability.result !== 'blocked';
}

export function buildDeployabilityOpenTasks(deployability: EmployeeDeployabilityCheck): string[] {
  return [
    ...deployability.blockers.map((issue) => issue.message),
    ...deployability.warnings.map((issue) => issue.message),
  ].slice(0, 8);
}

export function aggregateQualificationStatus(
  qualifications: EmployeeQualificationRecord[],
): EmployeeQualificationStatus | 'mixed' {
  return resolveQualificationOverview(qualifications);
}

export function roleCanPerformAssignment(roleKey: RoleKey | null): boolean {
  if (!roleKey) return false;
  return !['client_portal', 'family_portal'].includes(roleKey);
}
