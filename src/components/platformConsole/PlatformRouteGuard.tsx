import { ReactNode, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'expo-router';
import { ErrorState, LoadingState } from '@/components/ui';
import { usePlatformAuth } from '@/lib/platformConsole/PlatformAuthProvider';
import { buildPlatformLoginPath, resolvePlatformAuthRedirectPath } from '@/lib/platformConsole/platformLoginPath';
import { hasSupabaseAuthSession } from '@/lib/platformConsole/platformSession';

type PlatformRouteGuardProps = {
  children: ReactNode;
};

function usePlatformSessionReady() {
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const session = await hasSupabaseAuthSession();
      if (cancelled) return;
      setHasSession(session);
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { ready, hasSession };
}

export function PlatformSessionGate({ children }: PlatformRouteGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { ready, hasSession } = usePlatformSessionReady();
  const redirectPathRef = useRef<string | null>(null);
  if (redirectPathRef.current === null) {
    redirectPathRef.current = resolvePlatformAuthRedirectPath(pathname);
  }

  useEffect(() => {
    if (!ready || hasSession) return;
    router.replace(buildPlatformLoginPath(redirectPathRef.current ?? '/platform/dashboard') as never);
  }, [ready, hasSession, router]);

  if (!ready) {
    return <LoadingState message="Sitzung wird geprüft…" />;
  }

  if (!hasSession) {
    return <LoadingState message="Weiterleitung zur Platform-Anmeldung…" />;
  }

  return <>{children}</>;
}

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
    <PlatformSessionGate>
      <PlatformRouteGuard>{children}</PlatformRouteGuard>
    </PlatformSessionGate>
  );
}
