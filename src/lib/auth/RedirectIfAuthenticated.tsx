import { ReactNode, useEffect } from 'react';
import { BackHandler } from 'react-native';
import { useRouter } from 'expo-router';
import { FullScreenLoader } from '@/components/ui';
import { resolveSessionHomeRoute } from '@/lib/navigation/sessionRouting';
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
  const { isInitialized, isLoading, isAuthenticated, profile, portalSession } = useAuth();

  const hasSessionTarget = Boolean(portalSession || profile?.roleKey);
  const homePath = String(
    resolveSessionHomeRoute(profile?.roleKey ?? null, portalSession),
  );

  useEffect(() => {
    if (!isInitialized || isLoading || !isAuthenticated || !hasSessionTarget) return;
    router.replace(homePath as never);
  }, [hasSessionTarget, homePath, isAuthenticated, isInitialized, isLoading, router]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      router.replace(homePath as never);
      return true;
    });

    return () => subscription.remove();
  }, [homePath, isAuthenticated, router]);

  if (!isInitialized || isLoading) {
    return <FullScreenLoader message="Sitzung wird geprüft…" />;
  }

  if (isAuthenticated) {
    return <FullScreenLoader message={loadingMessage} />;
  }

  return <>{children}</>;
}
