import type { RoleKey } from '@/types/core/auth';
import type {
  EmployeeDeployabilityCheck,
  EmployeePersonnelFile,
} from '@/types/modules/employeePersonnelFile';
import type { EmployeeTrainingDeployability } from '@/types/modules/training';
import { evaluateComplianceDeployability } from './complianceTrainingService';
import {
  evaluateEmployeeDeployability,
  isEmployeeAssignable,
} from './employeeDeployabilityService';
import { evaluateEmployeeTrainingDeployability } from '@/lib/training/trainingService';

export type EmployeeAssignmentEligibility = {
  deployable: boolean;
  result: 'assignable' | 'warning' | 'blocked';
  personnelDeployability: EmployeeDeployabilityCheck;
  trainingDeployability: EmployeeTrainingDeployability;
  complianceBlockers: string[];
  blockers: string[];
  warnings: string[];
};

export function evaluateEmployeeAssignmentEligibility(input: {
  tenantId: string;
  employeeId: string;
  personnelFile: EmployeePersonnelFile;
  roleKey?: RoleKey | null;
  absent?: boolean;
  blocked?: boolean;
  reference?: Date;
}): EmployeeAssignmentEligibility {
  const { personnelFile } = input;

  const personnelDeployability = evaluateEmployeeDeployability({
    employment: personnelFile.employment,
    portalAccess: personnelFile.portalAccess,
    qualifications: personnelFile.qualifications,
    backgroundCheck: personnelFile.backgroundCheck,
    documents: personnelFile.documents,
    roleTitle: personnelFile.masterData.roleTitle,
    roleKey: input.roleKey ?? personnelFile.portalAccess.roleKey,
    tenantId: input.tenantId,
    employeeId: input.employeeId,
    blocked: input.blocked ?? personnelFile.masterData.status === 'gesperrt',
    absent: input.absent,
    reference: input.reference,
  });

  const trainingDeployability = evaluateEmployeeTrainingDeployability({
    tenantId: input.tenantId,
    employeeId: input.employeeId,
    roleKey: input.roleKey ?? personnelFile.portalAccess.roleKey,
    jobTitle: personnelFile.masterData.roleTitle,
    reference: input.reference,
  });

  const compliance = evaluateComplianceDeployability(
    input.tenantId,
    input.employeeId,
    input.roleKey ?? personnelFile.portalAccess.roleKey ?? null,
    input.reference,
  );

  const blockers = [
    ...personnelDeployability.blockers.map((i) => i.message),
    ...trainingDeployability.blockers.map((i) => i.message),
    ...compliance.blockers,
  ];

  const warnings = [
    ...personnelDeployability.warnings.map((i) => i.message),
    ...trainingDeployability.warnings.map((i) => i.message),
  ];

  const personnelBlocked = !isEmployeeAssignable(personnelDeployability);
  const trainingBlocked = !trainingDeployability.deployable;
  const complianceBlocked = !compliance.ok;

  const deployable = !personnelBlocked && !trainingBlocked && !complianceBlocked;

  let result: EmployeeAssignmentEligibility['result'] = 'assignable';
  if (!deployable) result = 'blocked';
  else if (warnings.length > 0 || personnelDeployability.result === 'warning') result = 'warning';

  return {
    deployable,
    result,
    personnelDeployability,
    trainingDeployability,
    complianceBlockers: compliance.blockers,
    blockers,
    warnings,
  };
}
