import type { AuthSession, AuthUser, Profile, RoleKey } from '@/types';
import { getDemoProfileForRole } from '@/data/demo/profiles';
import { ROLE_LABELS } from '@/data/demo/roles';

export function buildDemoSession(roleKey: RoleKey): {
  user: AuthUser;
  profile: Profile;
  session: AuthSession;
} {
  const profile = getDemoProfileForRole(roleKey);

  const user: AuthUser = {
    id: profile.id,
    email: profile.email ?? 'demo@caresuiteplus.app',
    displayName: profile.displayName,
    roleKey: profile.roleKey,
  };

  const session: AuthSession = {
    user,
    accessToken: 'demo-access-token',
    refreshToken: 'demo-refresh-token',
    expiresAt: Date.now() + 86_400_000,
  };

  return { user, profile, session };
}

export function getDemoLoginLabel(roleKey: RoleKey): string {
  return `Als ${ROLE_LABELS[roleKey]} anmelden`;
}
