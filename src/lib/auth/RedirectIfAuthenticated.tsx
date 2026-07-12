import { ReactNode, startTransition, useEffect } from 'react';
import { BackHandler } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { ErrorState, FullScreenLoader } from '@/components/ui';
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
  const hydrated = useHydrated();
  const { authReady, authMode, isAuthenticated, profile, portalSession, user, session } = useAuth();
  const sessionPending = useSupabaseSessionProbe(authMode, authReady, isAuthenticated);

  const { homePath, canRedirectHome } = resolveAuthSessionTarget({
    profile,
    portalSession,
    user,
    session,
  });

  useEffect(() => {
    if (!hydrated || !authReady || !isAuthenticated || !canRedirectHome) return;
    if (isAuthSetupRoute(pathname)) return;
    if (matchesNavigationTarget(pathname, homePath)) return;
    startTransition(() => {
      router.replace(homePath as never);
    });
  }, [canRedirectHome, homePath, hydrated, isAuthenticated, authReady, pathname, router]);

  useEffect(() => {
    if (!isAuthenticated || !canRedirectHome) return undefined;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      router.replace(homePath as never);
      return true;
    });

    return () => subscription.remove();
  }, [canRedirectHome, homePath, isAuthenticated, router]);

  if (!hydrated || !authReady || sessionPending) {
    return <FullScreenLoader message="Sitzung wird geprüft…" />;
  }

  if (isAuthenticated && canRedirectHome && !isAuthSetupRoute(pathname)) {
    if (!matchesNavigationTarget(pathname, homePath)) {
      return <FullScreenLoader message={loadingMessage} />;
    }
  }

  if (isAuthenticated && !canRedirectHome && !isAuthSetupRoute(pathname)) {
    return (
      <ErrorState
        title="Weiterleitung nicht möglich"
        message="Ihre Sitzung konnte keinem Zielbereich zugeordnet werden. Bitte erneut anmelden."
        onRetry={() => router.replace('/auth/business-login' as never)}
      />
    );
  }

  if (isAuthenticated && canRedirectHome && !isAuthSetupRoute(pathname)) {
    return <FullScreenLoader message={loadingMessage} />;
  }

  return <>{children}</>;
}
