import { resolveTvLoginReturn } from './tvDeviceLoginReturn.web';
import { ReactNode, useEffect } from 'react';
import { runAppTransition } from '@/lib/react/runAppTransition';
import { BackHandler } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { FullScreenLoader } from '@/components/ui';
import { useHydrated } from '@/hooks/useHydrated';
import { isAuthSetupRoute } from './loginRouter';
import { resolveAuthSessionTarget } from './sessionTarget';
import { useAuth } from './context';
import { useSupabaseSessionProbe } from './useSupabaseSessionProbe';

function matchesNavigationTarget(current: string, target: string): boolean {
  const normalizedCurrent = current.replace(/\/$/, '') || '/';
  const normalizedTarget = target.replace(/\/$/, '') || '/';
  return (
    normalizedCurrent === normalizedTarget ||
    normalizedCurrent.startsWith(`${normalizedTarget}/`)
  );
}

type RedirectIfAuthenticatedProps = {
  children: ReactNode;
  loadingMessage?: string;
};

/**
 * Auth stack guard — logged-in users skip login screens (no back-loop after sign-in).
 */
export function RedirectIfAuthenticated({
  children,
  loadingMessage = 'Weiterleitung zum Dashboard…',
}: RedirectIfAuthenticatedProps) {
  const router = useRouter();
  const pathname = usePathname();
  const normalizedPath = pathname.replace(/\/+$/, '');
  const isLoginOverview = normalizedPath === '/auth';
  const isPublicRecoveryRoute = normalizedPath === '/auth/forgot-password' || normalizedPath === '/auth/reset-password';
  const hydrated = useHydrated();
  const { authReady, authMode, isAuthenticated, profile, portalSession, user, session } = useAuth();
  const sessionPending = useSupabaseSessionProbe(authMode, authReady, isAuthenticated);

  const { homePath: sessionHomePath, canRedirectHome } = resolveAuthSessionTarget({
    profile,
    portalSession,
    user,
    session,
  });

  const homePath = resolveTvLoginReturn(sessionHomePath);

  useEffect(() => {
    if (!hydrated || !authReady || !isAuthenticated || !canRedirectHome) return;
    if (isLoginOverview || isAuthSetupRoute(pathname)) return;
    if (matchesNavigationTarget(pathname, homePath)) return;
    runAppTransition(() => {
      router.replace(homePath as never);
    });
  }, [canRedirectHome, homePath, hydrated, isAuthenticated, authReady, isLoginOverview, pathname, router]);

  useEffect(() => {
    if (isLoginOverview || isPublicRecoveryRoute || !isAuthenticated || !canRedirectHome) return undefined;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      router.replace(homePath as never);
      return true;
    });

    return () => subscription.remove();
  }, [canRedirectHome, homePath, isAuthenticated, isLoginOverview, isPublicRecoveryRoute, router]);

  // Keep public recovery navigation mounted from the first client render.
  // Replacing its nested Stack with a session loader loses a direct deep link
  // before the asynchronous session restore has finished.
  if (isLoginOverview || isPublicRecoveryRoute) return <>{children}</>;

  if (!hydrated || !authReady || sessionPending) {
    return <FullScreenLoader message="Sitzung wird geprüft…" />;
  }

  if (isAuthenticated && canRedirectHome && !isAuthSetupRoute(pathname)) {
    if (!matchesNavigationTarget(pathname, homePath)) {
      return <FullScreenLoader message={loadingMessage} />;
    }
  }

  // An unresolved saved identity must not lock the user out of public login
  // or recovery screens. Protected routes still enforce their own role guard.
  if (isAuthenticated && canRedirectHome && !isAuthSetupRoute(pathname)) {
    return <FullScreenLoader message={loadingMessage} />;
  }

  return <>{children}</>;
}
