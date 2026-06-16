import type { RoleKey } from '@/types/core/auth';
import type { ProductKey } from '@/types/core/tenant';
import type {
  AssignmentTrainingCheck,
  TrainingDeployabilityIssue,
} from '@/types/modules/training';
import type { AssignmentConflict } from '@/types/modules/assignmentWorkflow';
import { evaluateEmployeeTrainingDeployability } from './trainingService';

export function checkAssignmentTrainingEligibility(input: {
  tenantId: string;
  employeeId: string;
  roleKey?: RoleKey | null;
  moduleKeys?: ProductKey[];
  jobTitle?: string | null;
  requiresQualification?: boolean;
}): AssignmentTrainingCheck {
  const deployability = evaluateEmployeeTrainingDeployability({
    tenantId: input.tenantId,
    employeeId: input.employeeId,
    roleKey: input.roleKey,
    moduleKeys: input.moduleKeys,
    jobTitle: input.jobTitle,
  });

  const conflicts: TrainingDeployabilityIssue[] = [...deployability.blockers, ...deployability.warnings];

  if (input.requiresQualification && deployability.blockers.some((b) => b.code === 'mandatory_training_missing')) {
    return {
      allowed: false,
      conflicts,
      suggestAlternativesPrepared: true,
    };
  }

  return {
    allowed: deployability.blockers.length === 0,
    conflicts,
    suggestAlternativesPrepared: deployability.blockers.length > 0,
  };
}

export function trainingIssuesToAssignmentConflicts(
  issues: TrainingDeployabilityIssue[],
): AssignmentConflict[] {
  return issues.map((issue) => ({
    code:
      issue.code === 'mandatory_training_missing'
        ? 'mandatory_training_missing'
        : issue.code === 'training_expired'
          ? 'training_expired'
          : issue.code === 'certificate_expired' || issue.code === 'certificate_unverified'
            ? 'qualification_missing'
            : 'qualification_missing',
    message: issue.message,
    severity: issue.severity,
  }));
}

export function shouldSuggestAlternativeEmployees(check: AssignmentTrainingCheck): boolean {
  return !check.allowed && check.suggestAlternativesPrepared;
}

export function filterEmployeesEligibleForAssignment(input: {
  tenantId: string;
  employeeIds: string[];
  roleByEmployee: Record<string, RoleKey | null | undefined>;
  moduleKeys?: ProductKey[];
  jobTitleByEmployee?: Record<string, string | null>;
  requiresQualification?: boolean;
}): { eligible: string[]; blocked: Array<{ employeeId: string; issues: TrainingDeployabilityIssue[] }> } {
  const eligible: string[] = [];
  const blocked: Array<{ employeeId: string; issues: TrainingDeployabilityIssue[] }> = [];

  for (const employeeId of input.employeeIds) {
    const check = checkAssignmentTrainingEligibility({
      tenantId: input.tenantId,
      employeeId,
      roleKey: input.roleByEmployee[employeeId],
      moduleKeys: input.moduleKeys,
      jobTitle: input.jobTitleByEmployee?.[employeeId] ?? null,
      requiresQualification: input.requiresQualification,
    });

    if (check.allowed && !check.conflicts.some((c) => c.severity === 'error')) {
      eligible.push(employeeId);
    } else if (check.conflicts.some((c) => c.severity === 'error')) {
      blocked.push({ employeeId, issues: check.conflicts.filter((c) => c.severity === 'error') });
    } else {
      eligible.push(employeeId);
    }
  }

  return { eligible, blocked };
}
