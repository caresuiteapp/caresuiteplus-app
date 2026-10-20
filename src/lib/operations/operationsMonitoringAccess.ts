import type { RoleKey } from '@/types/core/auth';
import type { WorkspaceAccessContext } from '@/types/permissions/workspace';
import {
  buildWorkspaceAccessContext,
  canAccessAdminArea,
} from '@/lib/permissions/workspaceAccess';
import { isAdministrationRole } from '@/lib/permissions/workspaceRoles';

export type OperationsMonitoringAccessContext = WorkspaceAccessContext;

export function buildOperationsMonitoringAccessContext(input: {
  tenantId: string;
  roleKey: RoleKey | null;
  userId?: string | null;
}): OperationsMonitoringAccessContext {
  return buildWorkspaceAccessContext({
    tenantId: input.tenantId,
    roleKey: input.roleKey,
    userId: input.userId ?? 'demo-user',
  });
}

/** Admin-only Monitoring — business_admin oder security.manage */
export function canViewOperationsMonitoring(ctx: OperationsMonitoringAccessContext): {
  allowed: boolean;
  reason?: string;
} {
  const admin = canAccessAdminArea(ctx);
  if (!admin.allowed) {
    return { allowed: false, reason: admin.message ?? 'Verwaltungsbereich nicht freigegeben.' };
  }

  if (!isAdministrationRole(ctx.roleKey)) {
    return { allowed: false, reason: 'Betrieb & Monitoring nur für Verwaltungsrollen.' };
  }

  if (ctx.roleKey !== 'business_admin') {
    return {
      allowed: false,
      reason: 'Betrieb & Monitoring nur für Mandanten-Administratoren.',
    };
  }

  return { allowed: true };
}

export function canManageOperationsMonitoring(ctx: OperationsMonitoringAccessContext): boolean {
  return canViewOperationsMonitoring(ctx).allowed && ctx.roleKey === 'business_admin';
}

export function assertOperationsTenantScope(
  ctx: OperationsMonitoringAccessContext,
  resourceTenantId: string,
): { allowed: false; reason: string } | null {
  if (ctx.tenantId !== resourceTenantId) {
    return { allowed: false, reason: 'Kein mandantenübergreifender Zugriff auf Betrieb & Monitoring.' };
  }
  return null;
}

export function assertOperationsProductionSafety(
  ctx: OperationsMonitoringAccessContext,
): { allowed: true } | { allowed: false; reason: string } {
  if (ctx.environment === 'production' && ctx.usesDemoFallback) {
    return { allowed: false, reason: 'Demo-Fallback im Production Mode blockiert.' };
  }
  if (ctx.environment === 'production' && ctx.isDemoMode) {
    return { allowed: false, reason: 'Demo-Modus im Production Mode blockiert.' };
  }
  return { allowed: true };
}

export function filterOperationsRecordsForTenant<T extends { tenantId: string }>(
  records: T[],
  tenantId: string,
): T[] {
  return records.filter((row) => row.tenantId === tenantId);
}
