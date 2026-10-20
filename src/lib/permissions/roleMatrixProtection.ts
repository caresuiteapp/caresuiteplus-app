import type { CanonicalWorkspaceRoleKey } from '@/types/permissions/workspace';
import type {
  PermissionAreaKey,
  RoleAreaMatrix,
  RoleMatrixValidationResult,
  SaveRoleMatrixInput,
} from '@/types/permissions/roleMatrix';
import {
  CLIENT_PORTAL_ROLES,
  EMPLOYEE_ROLES,
  SYSTEM_PROTECTED_ROLES,
} from '@/types/permissions/roleMatrix';
import {
  buildDefaultRoleMatrix,
  hasBillingAdminAccess,
  hasConnectAdminAccess,
  hasHealthDataAccess,
} from './roleMatrixDefaults';

const OWNER_ADMIN_ROLES = new Set<CanonicalWorkspaceRoleKey>(['owner', 'admin']);

export function validateRoleMatrixChange(
  input: SaveRoleMatrixInput,
  currentMatrices: Record<CanonicalWorkspaceRoleKey, RoleAreaMatrix>,
  actorRoleKey?: CanonicalWorkspaceRoleKey | null,
): RoleMatrixValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { roleKey, areaPermissions } = input;
  const actor = input.actorRoleKey ?? actorRoleKey ?? null;

  if (SYSTEM_PROTECTED_ROLES.has(roleKey) && actor && !SYSTEM_PROTECTED_ROLES.has(actor)) {
    errors.push('System- und Developer-Admin-Rollen dürfen nur von Systemrollen geändert werden.');
  }

  if (CLIENT_PORTAL_ROLES.has(roleKey)) {
    const adminGranted =
      areaPermissions.administration.view ||
      areaPermissions.administration.edit ||
      areaPermissions.administration.administer;
    if (adminGranted) {
      errors.push('Klient:innen- und Angehörigenrollen dürfen keine Verwaltungsrechte erhalten.');
    }
  }

  if (EMPLOYEE_ROLES.has(roleKey)) {
    const billingAdmin = hasBillingAdminAccess(areaPermissions);
    const adminGranted = areaPermissions.administration.administer;
    if (billingAdmin || adminGranted) {
      if (!input.confirmBillingOverride) {
        warnings.push(
          'Mitarbeitendenrollen mit Abrechnungs- oder Admin-Rechten erfordern explizite Bestätigung.',
        );
        return {
          ok: false,
          errors,
          warnings,
          requiresBillingConfirm: true,
        };
      }
    }
  }

  if (roleKey === 'owner') {
    const admin = areaPermissions.administration;
    if (!admin.administer && !admin.approve) {
      errors.push('Inhaber:in darf nicht alle Owner-Rechte verlieren.');
    }
  }

  if (hasConnectAdminAccess(areaPermissions) && !OWNER_ADMIN_ROLES.has(roleKey)) {
    if (roleKey !== 'developer_admin') {
      errors.push('Connect-Credentials dürfen nur Owner/Admin/Developer-Admin zugewiesen werden.');
    }
  }

  const healthAccess = hasHealthDataAccess(areaPermissions);
  const previousHealth = hasHealthDataAccess(currentMatrices[roleKey] ?? buildDefaultRoleMatrix(roleKey));
  if (healthAccess && !previousHealth && !input.confirmHealthData) {
    return {
      ok: false,
      errors,
      warnings: ['Gesundheitsdaten-Zugriff erfordert explizite Bestätigung.'],
      requiresHealthDataConfirm: true,
    };
  }

  if (OWNER_ADMIN_ROLES.has(roleKey)) {
    const remainingAdmins = (['owner', 'admin'] as CanonicalWorkspaceRoleKey[]).filter((rk) => {
      if (rk === roleKey) {
        return areaPermissions.administration.administer || areaPermissions.administration.approve;
      }
      const m = currentMatrices[rk] ?? buildDefaultRoleMatrix(rk);
      return m.administration.administer || m.administration.approve;
    });
    if (remainingAdmins.length === 0) {
      errors.push('Mindestens eine Owner- oder Admin-Rolle muss Verwaltungsrechte behalten.');
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

export function canDeleteCustomRole(
  roleKey: CanonicalWorkspaceRoleKey,
  isSystemRole: boolean,
  actorRoleKey?: CanonicalWorkspaceRoleKey | null,
): { allowed: boolean; reason?: string } {
  if (isSystemRole || SYSTEM_PROTECTED_ROLES.has(roleKey)) {
    return { allowed: false, reason: 'Systemrollen können nicht gelöscht werden.' };
  }
  if (actorRoleKey && SYSTEM_PROTECTED_ROLES.has(roleKey) && !SYSTEM_PROTECTED_ROLES.has(actorRoleKey)) {
    return { allowed: false, reason: 'Geschützte Rollen dürfen nicht von normalen Admins gelöscht werden.' };
  }
  return { allowed: true };
}

export function requiresTenantContextForPortal(area: PermissionAreaKey): boolean {
  return area === 'employee_portal' || area === 'client_portal';
}

export function portalAreaWithoutTenant(
  areaPermissions: RoleAreaMatrix,
  tenantId?: string | null,
): string | null {
  if (!tenantId?.trim()) {
    const portalGranted =
      areaPermissions.employee_portal.view ||
      areaPermissions.client_portal.view ||
      areaPermissions.employee_portal.administer ||
      areaPermissions.client_portal.administer;
    if (portalGranted) {
      return 'Portal-Rechte erfordern einen Mandantenkontext.';
    }
  }
  return null;
}
