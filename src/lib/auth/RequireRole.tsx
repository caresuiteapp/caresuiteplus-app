import { ReactNode, useEffect, useState } from 'react';
import { runAppTransition } from '@/lib/react/runAppTransition';
import { useIsFocused, usePathname, useRouter } from 'expo-router';
import { ErrorState, LoadingState } from '@/components/ui';
import { useHydrated } from '@/hooks/useHydrated';
import { checkRoleAccess, getLoginRedirectForPath } from '@/lib/navigation';
import { resolveEffectiveRoleKey } from './sessionTarget';
import { useAuth } from './context';

const ROLE_RESOLUTION_TIMEOUT_MS = 8000;

function matchesNavigationTarget(current: string, target: string): boolean {
  const normalizedCurrent = current.replace(/\/$/, '') || '/';
  const normalizedTarget = target.replace(/\/$/, '') || '/';
  return (
    normalizedCurrent === normalizedTarget ||
    normalizedCurrent.startsWith(`${normalizedTarget}/`)
  );
}

type RequireRoleProps = {
  children: ReactNode;
  /** A retained native layout must also authorize its own route tree. */
  ownerPath?: string;
};

type StableRouter = { replace: (target: string) => void };

export function RequireRole({ children, ownerPath }: RequireRoleProps) {
  const pathname = usePathname();
  const focused = useIsFocused();
  const router = useRouter() as unknown as StableRouter;
  const hydrated = useHydrated();
  const {
    profile,
    portalSession,
    user,
    authReady,
    isAuthenticated,
    profileBootstrapError,
    retryProfileBootstrap,
  } = useAuth();
  const [roleWaitTimedOut, setRoleWaitTimedOut] = useState(false);

  const roleKey = resolveEffectiveRoleKey(profile, user, portalSession);
  const ownerDecision = ownerPath ? checkRoleAccess(ownerPath, roleKey) : null;
  const decision = ownerDecision?.shouldRedirect
    ? ownerDecision
    : checkRoleAccess(pathname, roleKey);
  const redirectTarget = String(decision.target);

  useEffect(() => {
    if (ownerPath && !focused) return;
    if (!hydrated || !authReady || !isAuthenticated || !roleKey || !decision.shouldRedirect) return;
    if (matchesNavigationTarget(pathname, redirectTarget)) return;
    runAppTransition(() => {
      router.replace(decision.target);
    });
  }, [
    decision.shouldRedirect,
    decision.target,
    hydrated,
    redirectTarget,
    isAuthenticated,
    authReady,
    pathname,
    roleKey,
    router,
    ownerPath,
    focused,
  ]);

  useEffect(() => {
    if (!authReady || !isAuthenticated || roleKey) {
      setRoleWaitTimedOut(false);
      return undefined;
    }

    const timer = setTimeout(() => setRoleWaitTimedOut(true), ROLE_RESOLUTION_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [authReady, isAuthenticated, roleKey]);

  // Kept native scenes share the foreground pathname. A portal route granting
  // its own role must not reactivate the business scene behind that portal.
  if (!focused && (!hydrated || !authReady || (isAuthenticated && !roleKey) || decision.shouldRedirect)) return null;

  if (!hydrated || !authReady) {
    return <LoadingState message="Sitzung wird geprüft…" />;
  }

  if (isAuthenticated && !roleKey) {
    if (profileBootstrapError || roleWaitTimedOut) {
      return (
        <ErrorState
          title="Berechtigungen nicht verfügbar"
          message={
            profileBootstrapError ??
            'Ihre Rolle konnte nicht geladen werden. Bitte erneut versuchen oder erneut anmelden.'
          }
          onRetry={() => {
            void retryProfileBootstrap();
          }}
        />
      );
    }

    return <LoadingState message="Berechtigungen werden geladen…" />;
  }

  if (isAuthenticated && decision.shouldRedirect && roleKey) {
    return <LoadingState message="Weiterleitung zum passenden Bereich…" />;
  }

  if (decision.shouldRedirect) {
    return (
      <ErrorState
        title="Kein Zugriff"
        message={decision.message ?? 'Sie haben keine Berechtigung für diesen Bereich.'}
        onRetry={() => router.replace(getLoginRedirectForPath(pathname) as never)}
      />
    );
  }

  return <>{children}</>;
}
