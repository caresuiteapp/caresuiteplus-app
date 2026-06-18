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
} from '@/types/modules/employeePersonnelFile';
import {
  ASSIGNABLE_EMPLOYMENT_STATUSES,
  getRequiredQualificationsForRole,
} from './employeePersonnelFieldRules';
import { isBackgroundCheckAssignable } from './employeeBackgroundCheckService';
import { hasRequiredQualifications } from './employeeQualificationService';

export type DeployabilityInput = {
  employment: EmployeeEmploymentDetails;
  portalAccess: EmployeePortalAccessRecord;
  qualifications: EmployeeQualificationRecord[];
  backgroundCheck: EmployeeBackgroundCheckRecord;
  documents: EmployeeDocumentRecord[];
  roleTitle: string | null;
  blocked?: boolean;
  absent?: boolean;
  availabilityOk?: boolean;
  backgroundCheckRequired?: boolean;
  portalRequired?: boolean;
};

function issue(
  code: string,
  message: string,
  severity: 'warning' | 'error',
): EmployeeDeployabilityIssue {
  return { code, message, severity };
}

export function evaluateEmployeeDeployability(input: DeployabilityInput): EmployeeDeployabilityCheck {
  const warnings: EmployeeDeployabilityIssue[] = [];
  const blockers: EmployeeDeployabilityIssue[] = [];

  const active = ASSIGNABLE_EMPLOYMENT_STATUSES.has(input.employment.employmentStatus);
  if (!active) {
    blockers.push(
      issue('employment_inactive', 'Mitarbeitende:r ist nicht einsatzfähig (Status).', 'error'),
    );
  }

  const portalOk =
    !input.portalRequired || (input.portalAccess.portalActive && Boolean(input.portalAccess.profileId));
  if (!portalOk) {
    blockers.push(issue('portal_inactive', 'Portalzugang nicht aktiv.', 'error'));
  } else if (!input.portalAccess.portalActive) {
    warnings.push(issue('portal_inactive', 'Portalzugang inaktiv.', 'warning'));
  }

  const requiredTypes = getRequiredQualificationsForRole(input.roleTitle);
  const qualCheck = hasRequiredQualifications(input.qualifications, requiredTypes);
  const qualificationOk = qualCheck.ok;
  if (!qualificationOk) {
    blockers.push(
      issue(
        'qualification_missing',
        `Qualifikation fehlt oder abgelaufen: ${qualCheck.missing.join(', ')}.`,
        'error',
      ),
    );
  }

  const notAbsent = !input.absent;
  if (input.absent) {
    blockers.push(issue('employee_absent', 'Mitarbeitende:r ist abwesend.', 'error'));
  }

  const backgroundCheckOk = isBackgroundCheckAssignable(
    input.backgroundCheck,
    input.backgroundCheckRequired ?? true,
  );
  if (!backgroundCheckOk) {
    blockers.push(
      issue('background_check_missing', 'Führungszeugnis fehlt oder abgelaufen.', 'error'),
    );
  }

  const availabilityOk = input.availabilityOk ?? true;
  if (!availabilityOk) {
    warnings.push(issue('outside_availability', 'Außerhalb hinterlegter Verfügbarkeit.', 'warning'));
  }

  const noBlock = !input.blocked;
  if (input.blocked) {
    blockers.push(issue('employee_blocked', 'Mitarbeitende:r ist gesperrt.', 'error'));
  }

  const missingRequiredDocs = input.documents.filter(
    (d) => d.category === 'contract' && !d.storagePath,
  );
  const requiredDocsOk = missingRequiredDocs.length === 0;
  if (!requiredDocsOk) {
    warnings.push(issue('missing_contract', 'Arbeitsvertrag fehlt.', 'warning'));
  }

  let result: EmployeeDeployabilityResult = 'assignable';
  if (blockers.length > 0) result = 'blocked';
  else if (warnings.length > 0) result = 'warning';

  return {
    result,
    active,
    portalOk,
    qualificationOk,
    notAbsent,
    backgroundCheckOk,
    availabilityOk,
    noBlock,
    requiredDocsOk,
    warnings,
    blockers,
  };
}

export function isEmployeeAssignable(deployability: EmployeeDeployabilityCheck): boolean {
  return deployability.result !== 'blocked';
}

export function buildDeployabilityOpenTasks(deployability: EmployeeDeployabilityCheck): string[] {
  return [...deployability.blockers, ...deployability.warnings].map((i) => i.message);
}

export function roleCanPerformAssignment(roleKey: RoleKey | null): boolean {
  if (!roleKey) return false;
  return !['client_portal', 'family_portal'].includes(roleKey);
}
