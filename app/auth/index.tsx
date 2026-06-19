import { Redirect } from 'expo-router';
import { LoadingState } from '@/components/ui';
import { useAuth } from '@/lib/auth/context';
import { resolveAuthSessionTarget } from '@/lib/auth/sessionTarget';
import { useSupabaseSessionProbe } from '@/lib/auth/useSupabaseSessionProbe';

/** Canonical public entry is `/` (AppStartScreen). Keep `/auth` as a stable alias. */
export default function AuthIndexRedirect() {
  const { isAuthenticated, authReady, authMode, profile, portalSession, user, session } = useAuth();
  const sessionPending = useSupabaseSessionProbe(authMode, authReady, isAuthenticated);

  if (!authReady || sessionPending) {
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
