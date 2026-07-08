import { ReactNode, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { ErrorState, LoadingState } from '@/components/ui';
import { RequireAuth } from '@/lib/auth';
import { usePlatformAuth } from '@/lib/platformConsole/PlatformAuthProvider';

type PlatformRouteGuardProps = {
  children: ReactNode;
};

export function PlatformRouteGuard({ children }: PlatformRouteGuardProps) {
  const router = useRouter();
  const { platformUser, loading, error, isActivePlatformUser, refresh } = usePlatformAuth();

  useEffect(() => {
    if (loading) return;
    if (!platformUser || !isActivePlatformUser) {
      router.replace('/platform/forbidden' as never);
    }
  }, [loading, platformUser, isActivePlatformUser, router]);

  if (loading) {
    return <LoadingState message="Platform-Zugriff wird geprüft…" />;
  }

  if (error) {
    return (
      <ErrorState
        title="Platform Console nicht erreichbar"
        message={error}
        onRetry={() => {
          void refresh();
        }}
      />
    );
  }

  if (!platformUser || !isActivePlatformUser) {
    return <LoadingState message="Weiterleitung…" />;
  }

  return <>{children}</>;
}

type PlatformAuthGateProps = {
  children: ReactNode;
};

export function PlatformAuthGate({ children }: PlatformAuthGateProps) {
  return (
    <RequireAuth redirectTo={'/auth/business-login' as never} loadingMessage="Anmeldung wird geprüft…">
      <PlatformRouteGuard>{children}</PlatformRouteGuard>
    </RequireAuth>
  );
}
