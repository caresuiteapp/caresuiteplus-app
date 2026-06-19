import { resolveSessionHomeRoute } from '@/lib/navigation/sessionRouting';
import type { AuthUser, Profile, RoleKey } from '@/types';
import type { PortalSessionRecord } from './portalSessionStore';

export type SessionTargetInput = {
  profile: Profile | null;
  portalSession: PortalSessionRecord | null;
  user: AuthUser | null;
};

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
  const hasSessionTarget = Boolean(input.portalSession || roleKey);
  const homePath = String(resolveSessionHomeRoute(roleKey, input.portalSession));
  const canRedirectHome = hasSessionTarget && homePath !== '/';

  return { roleKey, hasSessionTarget, homePath, canRedirectHome };
}
