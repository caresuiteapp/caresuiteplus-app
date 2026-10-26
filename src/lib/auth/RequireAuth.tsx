import { rememberWebLoginReturn, clearReachedWebLoginReturn } from '@/lib/navigation/webLoginReturn';
import { ReactNode, useEffect } from 'react';
import { runAppTransition } from '@/lib/react/runAppTransition';
import type { Href } from 'expo-router';
import { useIsFocused, usePathname, useRouter } from 'expo-router';
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
  const focused = useIsFocused();
  const hydrated = useHydrated();
  const { authReady, isAuthenticated, authMode } = useAuth();
  const sessionPending = useSupabaseSessionProbe(authMode, authReady, isAuthenticated);

  useEffect(() => {
    if (!focused || !hydrated || !authReady) return;
    if (isAuthenticated) { clearReachedWebLoginReturn(); return; }

    let cancelled = false;

    async function redirectIfStillAnonymous() {
      if (authMode === 'supabase') {
        const sessionResult = await getSession();
        if (cancelled) return;
        if (sessionResult.ok && sessionResult.data) {
          return;
        }
      }

      rememberWebLoginReturn();
      const target = redirectTo ? String(redirectTo) : getLoginRedirectForPath(pathname);
      runAppTransition(() => {
        router.replace(target as never);
      });
    }

    void redirectIfStillAnonymous();

    return () => {
      cancelled = true;
    };
  }, [authMode, authReady, focused, hydrated, isAuthenticated, pathname, redirectTo, router]);

  // StateViews publish global feedback. An inactive scene must stay blocked
  // quietly instead of opening a native modal over the foreground route.
  if (!focused && (!hydrated || !authReady || sessionPending || !isAuthenticated)) return null;

  if (!hydrated || !authReady || sessionPending) {
    return <LoadingState message={loadingMessage} />;
  }

  if (!isAuthenticated) {
    return <LoadingState message="Weiterleitung zur Anmeldung…" />;
  }

  return <>{children}</>;
}
