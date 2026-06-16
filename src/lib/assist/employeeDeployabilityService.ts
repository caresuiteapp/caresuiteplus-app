import type { RoleKey } from '@/types/core/auth';
import { hasPermission } from '@/lib/permissions';
export {
  evaluateEmployeeDeployability,
  isEmployeeAssignable,
  aggregateQualificationStatus,
} from '@/lib/office/employeeDeployabilityService';

/** Prüft ob Rolle Einsätze im Mitarbeiterportal ausführen darf. */
export function roleCanPerformAssignment(roleKey: RoleKey | null | undefined): boolean {
  if (!roleKey) return false;
  return hasPermission(roleKey, 'assist.execution.manage') || hasPermission(roleKey, 'assist.assignments.manage');
}
