import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth/context';
import { resolveAuthSessionTarget } from '@/lib/auth/sessionTarget';

/** Canonical public entry is `/` (AppStartScreen). Keep `/auth` as a stable alias. */
export default function AuthIndexRedirect() {
  const { isAuthenticated, profile, portalSession, user, session } = useAuth();

  if (isAuthenticated) {
    const { homePath, canRedirectHome } = resolveAuthSessionTarget({
      profile,
      portalSession,
      user,
      session,
    });
    if (canRedirectHome) {
      return <Redirect href={homePath as never} />;
    }
  }

  return <Redirect href="/" />;
}
