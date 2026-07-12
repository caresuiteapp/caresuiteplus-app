import { startTransition, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { LoadingState } from '@/components/ui';
import { useHydrated } from '@/hooks/useHydrated';
import { useAuth } from '@/lib/auth/context';
import { resolveAuthSessionTarget } from '@/lib/auth/sessionTarget';
import { useSupabaseSessionProbe } from '@/lib/auth/useSupabaseSessionProbe';

/** Canonical public entry is `/` (AppStartScreen). Keep `/auth` as a stable alias. */
export default function AuthIndexRedirect() {
  const router = useRouter();
  const hydrated = useHydrated();
  const { isAuthenticated, authReady, authMode, profile, portalSession, user, session } = useAuth();
  const sessionPending = useSupabaseSessionProbe(authMode, authReady, isAuthenticated);
  const { homePath, canRedirectHome } = resolveAuthSessionTarget({
    profile,
    portalSession,
    user,
    session,
  });

  useEffect(() => {
    if (!hydrated || !authReady || sessionPending) return;
    const target = isAuthenticated && canRedirectHome ? homePath : '/';
    startTransition(() => {
      router.replace(target as never);
    });
  }, [
    authReady,
    canRedirectHome,
    homePath,
    hydrated,
    isAuthenticated,
    router,
    sessionPending,
  ]);

  if (!hydrated || !authReady || sessionPending) {
    return <LoadingState message="Sitzung wird geprüft…" />;
  }

  return <LoadingState message="Weiterleitung…" />;
}
