import type { AssignmentConflict } from '@/types/modules/assignmentWorkflow';
import type { RoleKey } from '@/types/core/auth';
import { evaluateComplianceDeployability } from '@/lib/office/complianceTrainingService';
import {
  evaluateEmployeeDeployability,
  isEmployeeAssignable,
  roleCanPerformAssignment,
} from '@/lib/office/employeeDeployabilityService';
import { INACTIVE_EMPLOYMENT_STATUSES } from '@/lib/office/employeePersonnelFieldRules';
import { evaluateEmployeeTrainingDeployability } from '@/lib/training/trainingService';
import { trainingIssuesToAssignmentConflicts } from '@/lib/training/trainingAssignmentIntegration';
import { getEmployeePersonnelFileForAssignmentCheck } from './employeePersonnelFileService';

export function detectEmployeeEligibilityConflicts(input: {
  tenantId: string;
  employeeId: string | null;
  actorRoleKey?: RoleKey | null;
  absent?: boolean;
  availabilityOk?: boolean;
  requiresQualification?: boolean;
}): AssignmentConflict[] {
  const conflicts: AssignmentConflict[] = [];
  if (!input.employeeId?.trim()) return conflicts;

  const file = getEmployeePersonnelFileForAssignmentCheck(input.tenantId, input.employeeId);
  if (!file) {
    conflicts.push({
      code: 'employee_not_assignable',
      message: 'Mitarbeitende:r nicht gefunden oder mandantenfremd.',
      severity: 'error',
    });
    return conflicts;
  }

  if (INACTIVE_EMPLOYMENT_STATUSES.has(file.employment.employmentStatus)) {
    conflicts.push({
      code: 'employee_inactive',
      message: 'Keine Zuweisung an inaktive Mitarbeitende.',
      severity: 'error',
    });
  }

  if (file.masterData.status === 'gesperrt' || file.masterData.status === 'archiviert') {
    conflicts.push({
      code: 'employee_blocked',
      message: 'Mitarbeitende:r ist gesperrt oder archiviert.',
      severity: 'error',
    });
  }

  const deployability = evaluateEmployeeDeployability({
    employment: file.employment,
    portalAccess: file.portalAccess,
    qualifications: file.qualifications,
    backgroundCheck: file.backgroundCheck,
    documents: file.documents,
    roleTitle: file.masterData.roleTitle,
    roleKey: file.portalAccess.roleKey,
    tenantId: input.tenantId,
    employeeId: input.employeeId,
    blocked: file.masterData.status === 'gesperrt',
    absent: input.absent,
    availabilityOk: input.availabilityOk,
    backgroundCheckRequired: true,
    portalRequired: false,
  });

  const trainingDeployability = evaluateEmployeeTrainingDeployability({
    tenantId: input.tenantId,
    employeeId: input.employeeId,
    roleKey: file.portalAccess.roleKey,
    jobTitle: file.masterData.roleTitle,
  });

  conflicts.push(...trainingIssuesToAssignmentConflicts(trainingDeployability.blockers));
  conflicts.push(...trainingIssuesToAssignmentConflicts(trainingDeployability.warnings));

  const compliance = evaluateComplianceDeployability(
    input.tenantId,
    input.employeeId,
    file.portalAccess.roleKey,
  );
  if (!compliance.ok) {
    for (const message of compliance.blockers) {
      conflicts.push({
        code: 'mandatory_training_missing',
        message,
        severity: 'error',
      });
    }
  }

  if (!deployability.qualificationOk) {
    conflicts.push({
      code: 'qualification_missing',
      message: 'Qualifikation für Einsatz unzureichend.',
      severity: 'error',
    });
  }

  if (!deployability.backgroundCheckOk) {
    conflicts.push({
      code: 'background_check_missing',
      message: 'Führungszeugnis fehlt oder abgelaufen.',
      severity: 'error',
    });
  }

  for (const blocker of deployability.blockers) {
    if (blocker.code === 'compliance_training_missing') {
      conflicts.push({
        code: 'employee_not_assignable',
        message: blocker.message,
        severity: 'error',
      });
    }
  }

  if (input.absent) {
    conflicts.push({
      code: 'employee_absent',
      message: 'Mitarbeitende:r ist abwesend.',
      severity: 'error',
    });
  }

  if (input.availabilityOk === false) {
    conflicts.push({
      code: 'outside_availability',
      message: 'Einsatz außerhalb hinterlegter Verfügbarkeit.',
      severity: 'warning',
    });
  }

  if (!roleCanPerformAssignment(input.actorRoleKey ?? file.portalAccess.roleKey)) {
    conflicts.push({
      code: 'module_permission_missing',
      message: 'Rolle kann Einsatz nicht durchführen.',
      severity: 'error',
    });
  }

  if (!isEmployeeAssignable(deployability) || !trainingDeployability.deployable) {
    const blocker = deployability.blockers[0] ?? trainingDeployability.blockers[0];
    if (blocker && !conflicts.some((c) => c.message === blocker.message)) {
      conflicts.push({
        code: 'employee_not_assignable',
        message: blocker.message,
        severity: 'error',
      });
    }
  }

  for (const warning of deployability.warnings) {
    if (warning.code === 'outside_availability' && input.availabilityOk === false) continue;
    conflicts.push({
      code: warning.code as AssignmentConflict['code'],
      message: warning.message,
      severity: 'warning',
    });
  }

  return conflicts;
}
