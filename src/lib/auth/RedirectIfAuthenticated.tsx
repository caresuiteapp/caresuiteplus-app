import { ReactNode, useEffect } from 'react';
import { BackHandler } from 'react-native';
import { useRouter } from 'expo-router';
import { FullScreenLoader } from '@/components/ui';
import { resolveAuthSessionTarget } from './sessionTarget';
import { useAuth } from './context';

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
  const { isInitialized, isLoading, isAuthenticated, profile, portalSession, user } = useAuth();

  const { homePath, canRedirectHome } = resolveAuthSessionTarget({ profile, portalSession, user });

  useEffect(() => {
    if (!isInitialized || isLoading || !isAuthenticated || !canRedirectHome) return;
    router.replace(homePath as never);
  }, [canRedirectHome, homePath, isAuthenticated, isInitialized, isLoading, router]);

  useEffect(() => {
    if (!isAuthenticated || !canRedirectHome) return undefined;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      router.replace(homePath as never);
      return true;
    });

    return () => subscription.remove();
  }, [canRedirectHome, homePath, isAuthenticated, router]);

  if (!isInitialized || isLoading) {
    return <FullScreenLoader message="Sitzung wird geprüft…" />;
  }

  if (isAuthenticated) {
    return <FullScreenLoader message={loadingMessage} />;
  }

  return <>{children}</>;
}
