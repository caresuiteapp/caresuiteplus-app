import type { RoleKey } from '@/types/core/auth';
import type { PersonalComplianceRiskItem } from '@/types/modules/personalComplianceCockpit';
import {
  buildPersonnelAccessContext,
  type PersonnelAccessContext,
} from './employeePersonnelAccess';
import { ADMIN_ROLES_FOR_SENSITIVE_PERSONNEL } from './employeePersonnelFieldRules';
import { buildComplianceAccessContext } from './complianceTrainingAccess';
import { hasPermission } from '@/lib/permissions';
import { isClientPortalRole, isEmployeePortalRole } from '@/lib/permissions/workspaceRoles';

export type PersonalComplianceAccessContext = PersonnelAccessContext;

export function buildPersonalComplianceAccessContext(input: {
  tenantId: string;
  roleKey: RoleKey | null;
  userId?: string | null;
  employeeId?: string | null;
}): PersonalComplianceAccessContext {
  return buildPersonnelAccessContext({
    ...input,
    targetEmployeeId: input.employeeId ?? '__cockpit__',
  });
}

/** Regel 2/6 — Kein Klient:innen-Zugriff auf Personal-Compliance */
export function canViewPersonalComplianceCockpit(ctx: PersonalComplianceAccessContext): {
  allowed: boolean;
  reason?: string;
} {
  if (isClientPortalRole(ctx.roleKey)) {
    return {
      allowed: false,
      reason: 'Personal-Compliance ist für Klient:innenportale nicht verfügbar.',
    };
  }

  if (
    hasPermission(ctx.roleKey, 'office.employees.view') ||
    hasPermission(ctx.roleKey, 'qm.view')
  ) {
    return { allowed: true };
  }

  if (isEmployeePortalRole(ctx.roleKey) || ctx.roleKey === 'employee_portal') {
    return {
      allowed: false,
      reason: 'Personal-Compliance ist nur für Verwaltung, QM und Leitung verfügbar.',
    };
  }

  return { allowed: false, reason: 'Keine Berechtigung für Personal-Compliance-Cockpit.' };
}

export function canManagePersonalComplianceTasks(ctx: PersonalComplianceAccessContext): boolean {
  return (
    hasPermission(ctx.roleKey, 'office.employees.edit') ||
    hasPermission(ctx.roleKey, 'qm.manage_compliance')
  );
}

export function canViewSensitivePersonalComplianceRisk(
  ctx: PersonalComplianceAccessContext,
  risk: Pick<PersonalComplianceRiskItem, 'sensitive' | 'code'>,
): boolean {
  if (!risk.sensitive) return true;
  return ctx.roleKey != null && ADMIN_ROLES_FOR_SENSITIVE_PERSONNEL.includes(ctx.roleKey);
}

export function filterPersonalComplianceRisksForViewer(
  ctx: PersonalComplianceAccessContext,
  risks: PersonalComplianceRiskItem[],
): PersonalComplianceRiskItem[] {
  return risks.map((risk) => {
    if (!canViewSensitivePersonalComplianceRisk(ctx, risk)) {
      return {
        ...risk,
        message: 'Sensible HR-Information — nur für autorisierte Rollen.',
        title: risk.title,
        sensitive: true,
      };
    }
    return risk;
  });
}

export function canViewComplianceBriefingData(roleKey: RoleKey | null): boolean {
  const ctx = buildComplianceAccessContext({ tenantId: 'noop', roleKey });
  return canViewPersonalComplianceCockpit(
    buildPersonalComplianceAccessContext({ tenantId: 'noop', roleKey }),
  ).allowed && ctx.roleKey != null;
}

export function assertPersonalComplianceTenantScope(
  ctx: PersonalComplianceAccessContext,
  tenantId: string,
): { allowed: false; reason: string } | null {
  if (ctx.tenantId !== tenantId) {
    return { allowed: false, reason: 'Kein mandantenübergreifender Zugriff auf Personal-Compliance.' };
  }
  return null;
}
