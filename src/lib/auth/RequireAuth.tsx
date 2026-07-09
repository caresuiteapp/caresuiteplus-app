import { ReactNode, startTransition, useEffect } from 'react';
import type { Href } from 'expo-router';
import { usePathname, useRouter } from 'expo-router';
import { LoadingState } from '@/components/ui';
import { useHydrated } from '@/hooks/useHydrated';
import { getLoginRedirectForPath } from '@/lib/navigation';
import { getSession } from '@/lib/supabase';
import { useAuth } from './context';
import { useSupabaseSessionProbe } from './useSupabaseSessionProbe';

type RequireAuthProps = {
  children: ReactNode;
  redirectTo?: Href;
  loadingMessage?: string;
};

export function RequireAuth({
  children,
  redirectTo,
  loadingMessage = 'Sitzung wird geprüft…',
}: RequireAuthProps) {
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useHydrated();
  const { authReady, isAuthenticated, authMode } = useAuth();
  const sessionPending = useSupabaseSessionProbe(authMode, authReady, isAuthenticated);

  useEffect(() => {
    if (!hydrated || !authReady || isAuthenticated) return;

    let cancelled = false;

    async function redirectIfStillAnonymous() {
      if (authMode === 'supabase') {
        const sessionResult = await getSession();
        if (cancelled) return;
        if (sessionResult.ok && sessionResult.data) {
          return;
        }
      }

      const target = redirectTo ? String(redirectTo) : getLoginRedirectForPath(pathname);
      startTransition(() => {
        router.replace(target as never);
      });
    }

    void redirectIfStillAnonymous();

    return () => {
      cancelled = true;
    };
  }, [authMode, authReady, hydrated, isAuthenticated, pathname, redirectTo, router]);

  if (!hydrated || !authReady || sessionPending) {
    return <LoadingState message={loadingMessage} />;
  }

  if (!isAuthenticated) {
    return <LoadingState message="Weiterleitung zur Anmeldung…" />;
  }

  return <>{children}</>;
}
