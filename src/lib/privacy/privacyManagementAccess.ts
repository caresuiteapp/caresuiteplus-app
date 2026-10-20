import type { RoleKey } from '@/types/core/auth';
import type { PrivacyDataSubjectRequest, PrivacyRetentionRule } from '@/types/modules/privacyManagement';
import { hasPermission } from '@/lib/permissions/check';
import type { WorkspaceAccessContext } from '@/types/permissions/workspace';
import {
  buildWorkspaceAccessContext,
} from '@/lib/permissions/workspaceAccess';
import { isClientPortalRole, isEmployeePortalRole } from '@/lib/permissions/workspaceRoles';

export type PrivacyAccessContext = WorkspaceAccessContext;

export function buildPrivacyAccessContext(input: {
  tenantId: string;
  roleKey: RoleKey | null;
  userId?: string | null;
  environment?: WorkspaceAccessContext['environment'];
  isDemoMode?: boolean;
  usesDemoFallback?: boolean;
}): PrivacyAccessContext {
  return buildWorkspaceAccessContext({
    tenantId: input.tenantId,
    roleKey: input.roleKey,
    userId: input.userId ?? 'demo-user',
    environment: input.environment,
    isDemoMode: input.isDemoMode,
    usesDemoFallback: input.usesDemoFallback,
  });
}

/** Regel 5 — Mandantentrennung */
export function assertPrivacyTenantScope(
  ctx: PrivacyAccessContext,
  resourceTenantId: string,
): { allowed: true } | { allowed: false; reason: string } {
  if (resourceTenantId !== ctx.tenantId) {
    return { allowed: false, reason: 'Datensatz gehört zu einem anderen Mandanten.' };
  }
  return { allowed: true };
}

/** Regel 6 — Keine Demo-Fallbacks im Production Mode */
export function assertPrivacyProductionSafety(
  ctx: PrivacyAccessContext,
): { allowed: true } | { allowed: false; reason: string } {
  if (ctx.environment === 'production' && ctx.usesDemoFallback) {
    return { allowed: false, reason: 'Demo-Fallback im Production Mode blockiert.' };
  }
  if (ctx.environment === 'production' && ctx.isDemoMode) {
    return { allowed: false, reason: 'Demo-Modus im Production Mode blockiert.' };
  }
  return { allowed: true };
}

export function canManagePrivacyCompliance(ctx: PrivacyAccessContext): boolean {
  return hasPermission(ctx.roleKey, 'security.manage');
}

export function canViewPrivacyCompliance(ctx: PrivacyAccessContext): boolean {
  return hasPermission(ctx.roleKey, 'security.view') || canManagePrivacyCompliance(ctx);
}

/** Regel 2 — Gesundheitsdaten-Export nur mit view_sensitive */
export function canExportPrivacyHealthData(ctx: PrivacyAccessContext): {
  allowed: boolean;
  reason?: string;
} {
  const production = assertPrivacyProductionSafety(ctx);
  if (!production.allowed) return production;

  if (isClientPortalRole(ctx.roleKey) || isEmployeePortalRole(ctx.roleKey)) {
    return { allowed: false, reason: 'Gesundheitsdaten-Export für Portale nicht freigegeben.' };
  }

  if (hasPermission(ctx.roleKey, 'office.clients.view_sensitive')) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: 'Gesundheitsdaten-Export nur mit Berechtigung „Sensible Gesundheitsdaten einsehen“.',
  };
}

/** Regel 1 — Löschung nur nach Prüfung und Berechtigung */
export function canReviewPrivacyDeletion(ctx: PrivacyAccessContext): boolean {
  return canManagePrivacyCompliance(ctx);
}

export function canExecutePrivacyDeletion(ctx: PrivacyAccessContext): boolean {
  return (
    canManagePrivacyCompliance(ctx) &&
    hasPermission(ctx.roleKey, 'security.manage')
  );
}

export function filterPrivacyRequestsForTenant(
  requests: PrivacyDataSubjectRequest[],
  tenantId: string,
): PrivacyDataSubjectRequest[] {
  return requests.filter((row) => row.tenantId === tenantId);
}

/** Regel 3 — Aufbewahrungsfrist prüfen */
export function evaluateRetentionBlock(
  entityType: string,
  entityCreatedAt: string,
  rules: PrivacyRetentionRule[],
  referenceDate = new Date(),
): { blocked: boolean; rule: PrivacyRetentionRule | null; reason: string | null } {
  const rule = rules.find(
    (r) => r.status === 'active' && r.blockDeletionUntil && r.entityType === entityType,
  );
  if (!rule) {
    return { blocked: false, rule: null, reason: null };
  }

  const created = new Date(entityCreatedAt);
  const expiry = new Date(created);
  expiry.setDate(expiry.getDate() + rule.retentionDays);

  if (referenceDate < expiry) {
    return {
      blocked: true,
      rule,
      reason: `Löschung blockiert: Aufbewahrungsfrist (${rule.label}, ${rule.legalReference}) bis ${expiry.toLocaleDateString('de-DE')}.`,
    };
  }

  return { blocked: false, rule, reason: null };
}
