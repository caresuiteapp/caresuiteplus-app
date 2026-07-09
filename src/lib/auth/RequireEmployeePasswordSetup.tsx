import { ReactNode, startTransition, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { LoadingState } from '@/components/ui';
import { useHydrated } from '@/hooks/useHydrated';
import { resolveEmployeeFirstLoginHref } from './loginRouter';
import { useAuth } from './context';

type RequireEmployeePasswordSetupProps = {
  children: ReactNode;
};

/** Blocks employee portal until a permanent password replaces the one-time password. */
export function RequireEmployeePasswordSetup({ children }: RequireEmployeePasswordSetupProps) {
  const router = useRouter();
  const hydrated = useHydrated();
  const { authReady, portalSession } = useAuth();

  const needsSetup =
    portalSession?.loginType === 'employee_portal' &&
    portalSession.mustChangePassword === true &&
    Boolean(portalSession.accountId);

  useEffect(() => {
    if (!hydrated || !authReady || !needsSetup || !portalSession?.accountId) return;
    startTransition(() => {
      router.replace(resolveEmployeeFirstLoginHref(portalSession.accountId) as never);
    });
  }, [authReady, hydrated, needsSetup, portalSession?.accountId, router]);

  if (!hydrated || !authReady) {
    return <LoadingState message="Sitzung wird geprüft…" />;
  }

  if (needsSetup && portalSession?.accountId) {
    return <LoadingState message="Weiterleitung zur Passwortvergabe…" />;
  }

  return <>{children}</>;
}
