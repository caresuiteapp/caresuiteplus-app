import type { RoleKey } from '@/types/core/auth';
import type { ComplianceTrainingAssignment } from '@/types/modules/complianceTraining';
import type { WorkspaceAccessContext } from '@/types/permissions/workspace';
import { buildWorkspaceAccessContext } from '@/lib/permissions/workspaceAccess';
import { hasPermission } from '@/lib/permissions';
import { isClientPortalRole, isEmployeePortalRole } from '@/lib/permissions/workspaceRoles';

export type ComplianceAccessContext = WorkspaceAccessContext & {
  targetEmployeeId?: string | null;
};

export function buildComplianceAccessContext(input: {
  tenantId: string;
  roleKey: RoleKey | null;
  userId?: string | null;
  employeeId?: string | null;
  targetEmployeeId?: string | null;
}): ComplianceAccessContext {
  return {
    ...buildWorkspaceAccessContext({
      tenantId: input.tenantId,
      roleKey: input.roleKey,
      userId: input.userId ?? 'demo-user',
      employeeId: input.employeeId ?? null,
    }),
    targetEmployeeId: input.targetEmployeeId ?? null,
  };
}

/** Regel 6 — Klient:innenportale sehen keine Unterweisungsdaten */
export function canViewComplianceTrainingData(ctx: ComplianceAccessContext): {
  allowed: boolean;
  reason?: string;
} {
  if (isClientPortalRole(ctx.roleKey)) {
    return {
      allowed: false,
      reason: 'Pflichtunterweisungen sind für Klient:innenportale nicht sichtbar.',
    };
  }
  return { allowed: true };
}
export function canViewEmployeeComplianceAssignments(
  ctx: ComplianceAccessContext,
  employeeId: string,
): boolean {
  if (isEmployeePortalRole(ctx.roleKey) || ctx.roleKey === 'employee_portal') {
    return ctx.employeeId === employeeId;
  }
  return hasPermission(ctx.roleKey, 'office.employees.view');
}

export function canManageComplianceTraining(ctx: ComplianceAccessContext): boolean {
  return hasPermission(ctx.roleKey, 'office.employees.compliance.manage')
    || hasPermission(ctx.roleKey, 'qm.manage_compliance');
}

export function canAcknowledgeComplianceTraining(
  ctx: ComplianceAccessContext,
  assignment: ComplianceTrainingAssignment,
): boolean {
  if (isEmployeePortalRole(ctx.roleKey) || ctx.roleKey === 'employee_portal') {
    return ctx.employeeId === assignment.employeeId;
  }
  return canManageComplianceTraining(ctx);
}

export function filterComplianceAssignmentsForViewer(
  ctx: ComplianceAccessContext,
  assignments: ComplianceTrainingAssignment[],
): ComplianceTrainingAssignment[] {
  if (isEmployeePortalRole(ctx.roleKey) || ctx.roleKey === 'employee_portal') {
    if (!ctx.employeeId) return [];
    return assignments.filter((row) => row.employeeId === ctx.employeeId);
  }
  if (!hasPermission(ctx.roleKey, 'office.employees.view')) return [];
  return assignments;
}

export function assertComplianceTenantScope(
  ctx: ComplianceAccessContext,
  tenantId: string,
): { allowed: false; reason: string } | null {
  if (ctx.tenantId !== tenantId) {
    return { allowed: false, reason: 'Kein mandantenübergreifender Zugriff auf Unterweisungen.' };
  }
  return null;
}
