import { resolveSessionHomeRoute } from '@/lib/navigation/sessionRouting';
import { BUSINESS_HOME_ROUTE } from '@/lib/navigation/businessHome';
import type { AuthSession, AuthUser, Profile, RoleKey } from '@/types';
import { resolveEmployeeFirstLoginHref } from './loginRouter';
import type { PortalSessionRecord } from './portalSessionStore';

export type SessionTargetInput = {
  profile: Profile | null;
  portalSession: PortalSessionRecord | null;
  user: AuthUser | null;
  session?: AuthSession | null;
};

const BUSINESS_FALLBACK_HOME = BUSINESS_HOME_ROUTE;

export function resolveEffectiveRoleKey(
  profile: Profile | null,
  user: AuthUser | null,
  portalSession?: PortalSessionRecord | null,
): RoleKey | null {
  // Active portal login must win over a stale business/profile role still in memory.
  if (portalSession?.roleKey) {
    return portalSession.roleKey;
  }
  return profile?.roleKey ?? user?.roleKey ?? null;
}

export function resolveAuthSessionTarget(input: SessionTargetInput) {
  const roleKey = resolveEffectiveRoleKey(input.profile, input.user, input.portalSession);
  const hasSupabaseSession = Boolean(input.user && input.session);
  const hasSessionTarget = Boolean(input.portalSession || roleKey || hasSupabaseSession);

  let homePath = String(resolveSessionHomeRoute(roleKey, input.portalSession));
  if (
    input.portalSession?.loginType === 'employee_portal' &&
    input.portalSession.mustChangePassword &&
    input.portalSession.accountId
  ) {
    homePath = String(resolveEmployeeFirstLoginHref(input.portalSession.accountId));
  } else if (hasSupabaseSession && !input.portalSession && !roleKey) {
    homePath = BUSINESS_FALLBACK_HOME;
  }

  const canRedirectHome = hasSessionTarget && (homePath !== '/' || BUSINESS_HOME_ROUTE === '/');

  return { roleKey, hasSessionTarget, homePath, canRedirectHome };
}
