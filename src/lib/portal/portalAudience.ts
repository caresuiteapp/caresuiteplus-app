import type { RoleKey } from '@/types';
import type { PortalScope } from '@/types/portal';

export type OperationalPortalAudience = 'client' | 'employee';

export function isRoleAllowedForPortalAudience(
  roleKey: RoleKey | null | undefined,
  audience: OperationalPortalAudience,
): boolean {
  if (audience === 'employee') {
    return roleKey === 'employee_portal' || roleKey === 'caregiver' || roleKey === 'nurse';
  }

  return roleKey === 'client_portal' || roleKey === 'family_portal';
}

export function portalScopeForAudience(
  audience: OperationalPortalAudience,
): PortalScope {
  return audience === 'employee' ? 'portal_employee' : 'portal_client';
}

export function portalAudienceForRole(
  roleKey: RoleKey | null | undefined,
): OperationalPortalAudience | null {
  if (isRoleAllowedForPortalAudience(roleKey, 'employee')) return 'employee';
  if (isRoleAllowedForPortalAudience(roleKey, 'client')) return 'client';
  return null;
}
