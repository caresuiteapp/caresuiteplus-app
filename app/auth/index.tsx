import { Redirect } from 'expo-router';
import { LoadingState } from '@/components/ui';
import { useAuth } from '@/lib/auth/context';
import { resolveAuthSessionTarget } from '@/lib/auth/sessionTarget';

/** Canonical public entry is `/` (AppStartScreen). Keep `/auth` as a stable alias. */
export default function AuthIndexRedirect() {
  const { isAuthenticated, authReady, profile, portalSession, user, session } = useAuth();

  if (!authReady) {
    return <LoadingState message="Sitzung wird geprüft…" />;
  }

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

    return <LoadingState message="Weiterleitung zum Dashboard…" />;
  }

  return <Redirect href="/" />;
}
