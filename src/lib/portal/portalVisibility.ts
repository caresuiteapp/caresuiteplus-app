import type { RoleKey } from '@/types/core/auth';
import type { PortalScope } from '@/types/portal';
import type { DataVisibilityScope, PortalScopedEntity } from '@/types/portal/visibility';

/** Demo-Verknüpfung zwischen Profil und fachlichen Entitäten */
export type PortalProfileLink = {
  employeeId?: string;
  clientId?: string;
};

export const DEMO_PORTAL_LINKS: Record<string, PortalProfileLink> = {
  'profile-portal-employee-001': { employeeId: 'employee-003' },
  'profile-employee-001': { employeeId: 'employee-001' },
  'profile-nurse-001': { employeeId: 'employee-002' },
  'profile-client-001': { clientId: 'client-001' },
  'profile-family-001': { clientId: 'client-001' },
};

export function resolvePortalScope(roleKey: RoleKey | null): PortalScope {
  switch (roleKey) {
    case 'employee_portal':
    case 'caregiver':
    case 'nurse':
      return 'portal_employee';
    case 'family_portal':
      return 'portal_family';
    case 'client_portal':
    default:
      return 'portal_client';
  }
}

const EMPLOYEE_SCOPES: DataVisibilityScope[] = ['own', 'team'];
const CLIENT_SCOPES: DataVisibilityScope[] = ['own', 'shared'];
const FAMILY_SCOPES: DataVisibilityScope[] = ['shared'];

function allowedVisibilityScopes(scope: PortalScope): DataVisibilityScope[] {
  switch (scope) {
    case 'portal_employee':
      return EMPLOYEE_SCOPES;
    case 'portal_family':
      return FAMILY_SCOPES;
    case 'portal_client':
    default:
      return CLIENT_SCOPES;
  }
}

export function canViewPortalEntity(
  entity: PortalScopedEntity,
  profileId: string,
  scope: PortalScope,
): boolean {
  const allowed = allowedVisibilityScopes(scope);
  if (!allowed.includes(entity.visibility)) {
    return false;
  }

  if (entity.visibility === 'own') {
    return entity.ownedByProfileId === profileId;
  }

  if (entity.visibility === 'shared') {
    return (
      entity.ownedByProfileId === profileId ||
      (entity.sharedWithProfileIds?.includes(profileId) ?? false)
    );
  }

  if (entity.visibility === 'team') {
    return scope === 'portal_employee';
  }

  return false;
}

export function filterPortalEntities<T extends PortalScopedEntity>(
  items: T[],
  profileId: string,
  scope: PortalScope,
): T[] {
  return items.filter((item) => canViewPortalEntity(item, profileId, scope));
}

export function getPortalProfileLink(profileId: string): PortalProfileLink {
  return DEMO_PORTAL_LINKS[profileId] ?? {};
}
