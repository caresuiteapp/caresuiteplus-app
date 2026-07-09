import { ReactNode, useEffect } from 'react';
import { BackHandler } from 'react-native';
import { Redirect, usePathname, useRouter } from 'expo-router';
import { ErrorState, FullScreenLoader } from '@/components/ui';
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
  const { authReady, authMode, isAuthenticated, profile, portalSession, user, session } = useAuth();
  const sessionPending = useSupabaseSessionProbe(authMode, authReady, isAuthenticated);

  const { homePath, canRedirectHome } = resolveAuthSessionTarget({
    profile,
    portalSession,
    user,
    session,
  });

  useEffect(() => {
    if (!authReady || !isAuthenticated || !canRedirectHome) return;
    if (isAuthSetupRoute(pathname)) return;
    if (matchesNavigationTarget(pathname, homePath)) return;
    router.replace(homePath as never);
  }, [canRedirectHome, homePath, isAuthenticated, authReady, pathname, router]);

  useEffect(() => {
    if (!isAuthenticated || !canRedirectHome) return undefined;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      router.replace(homePath as never);
      return true;
    });

    return () => subscription.remove();
  }, [canRedirectHome, homePath, isAuthenticated, router]);

  if (!authReady || sessionPending) {
    return <FullScreenLoader message="Sitzung wird geprüft…" />;
  }

  if (isAuthenticated && canRedirectHome && !isAuthSetupRoute(pathname)) {
    if (!matchesNavigationTarget(pathname, homePath)) {
      return <Redirect href={homePath as never} />;
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
