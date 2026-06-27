/** Shared German labels for employee/client portal UI — no generic „Portal“ placeholders. */

export const PORTAL_EMPLOYEE_LABEL = 'Mitarbeiterportal';
export const PORTAL_CLIENT_LABEL = 'Klient:innenportal';
export const PORTAL_RELATIVE_LABEL = 'Angehörigenportal';
export const TENANT_NAME_FALLBACK = 'Ihr Unternehmen';

export type PortalDisplayScope = 'employee' | 'client' | 'relative';

export function resolvePortalScopeLabel(scope: PortalDisplayScope): string {
  switch (scope) {
    case 'employee':
      return PORTAL_EMPLOYEE_LABEL;
    case 'relative':
      return PORTAL_RELATIVE_LABEL;
    default:
      return PORTAL_CLIENT_LABEL;
  }
}

/** Screen subtitle when role label from permissions is missing. */
export function resolvePortalScreenSubtitle(
  roleLabel: string | null | undefined,
  scope: PortalDisplayScope = 'employee',
): string {
  const trimmed = roleLabel?.trim();
  if (trimmed) return trimmed;
  return resolvePortalScopeLabel(scope);
}
