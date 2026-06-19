import { resolveSessionHomeRoute } from '@/lib/navigation/sessionRouting';
import type { AuthSession, AuthUser, Profile, RoleKey } from '@/types';
import type { PortalSessionRecord } from './portalSessionStore';

export type SessionTargetInput = {
  profile: Profile | null;
  portalSession: PortalSessionRecord | null;
  user: AuthUser | null;
  session?: AuthSession | null;
};

const BUSINESS_FALLBACK_HOME = '/business';

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
  if (hasSupabaseSession && !input.portalSession && !roleKey) {
    homePath = BUSINESS_FALLBACK_HOME;
  }

  const canRedirectHome = hasSessionTarget && homePath !== '/';

  return { roleKey, hasSessionTarget, homePath, canRedirectHome };
}
