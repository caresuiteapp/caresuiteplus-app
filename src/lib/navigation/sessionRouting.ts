import type { AuthLoginType } from '@/lib/auth/auth.types';
import type { PortalSessionRecord } from '@/lib/auth/portalSessionStore';
import { resolvePostLoginRoute } from '@/lib/auth/loginRouter';
import type { RoleKey } from '@/types';

const EMPLOYEE_HOME_ROLES: RoleKey[] = ['employee_portal', 'caregiver', 'nurse'];
const CLIENT_HOME_ROLES: RoleKey[] = ['client_portal', 'family_portal'];

/** Canonical post-session destination — native app home per role. */
export function resolveSessionHomeRoute(
  roleKey: RoleKey | null | undefined,
  portalSession?: PortalSessionRecord | null,
): string {
  if (portalSession) {
    return String(resolvePostLoginRoute(portalSession.loginType as AuthLoginType));
  }

  if (!roleKey) {
    return '/';
  }

  if (CLIENT_HOME_ROLES.includes(roleKey)) {
    return '/portal/client';
  }

  if (EMPLOYEE_HOME_ROLES.includes(roleKey)) {
    return '/portal/employee';
  }

  return '/business';
}

/** Public entry — portal choice only when there is no active session. */
export function shouldShowPortalChoice(isAuthenticated: boolean): boolean {
  return !isAuthenticated;
}
