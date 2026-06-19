import { ReactNode, useEffect } from 'react';
import { usePathname, useRouter } from 'expo-router';
import { ErrorState, LoadingState } from '@/components/ui';
import { checkRoleAccess, getLoginRedirectForPath } from '@/lib/navigation';
import { resolveEffectiveRoleKey } from './sessionTarget';
import { useAuth } from './context';

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
};

export function RequireRole({ children }: RequireRoleProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, portalSession, user, isLoading, isAuthenticated } = useAuth();

  const roleKey = resolveEffectiveRoleKey(profile, user, portalSession);
  const decision = checkRoleAccess(pathname, roleKey);
  const redirectTarget = String(decision.target);

  useEffect(() => {
    if (isLoading || !isAuthenticated || !roleKey || !decision.shouldRedirect) return;
    if (matchesNavigationTarget(pathname, redirectTarget)) return;
    router.replace(decision.target);
  }, [
    decision.shouldRedirect,
    decision.target,
    redirectTarget,
    isAuthenticated,
    isLoading,
    pathname,
    roleKey,
    router,
  ]);

  if (isLoading) {
    return <LoadingState message="Sitzung wird geprüft…" />;
  }

  if (isAuthenticated && !roleKey) {
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
