import { ReactNode, useEffect } from 'react';
import { Redirect, useRouter } from 'expo-router';
import { LoadingState } from '@/components/ui';
import { resolveEmployeeFirstLoginHref } from './loginRouter';
import { useAuth } from './context';

type RequireEmployeePasswordSetupProps = {
  children: ReactNode;
};

/** Blocks employee portal until a permanent password replaces the one-time password. */
export function RequireEmployeePasswordSetup({ children }: RequireEmployeePasswordSetupProps) {
  const router = useRouter();
  const { authReady, portalSession } = useAuth();

  const needsSetup =
    portalSession?.loginType === 'employee_portal' &&
    portalSession.mustChangePassword === true &&
    Boolean(portalSession.accountId);

  useEffect(() => {
    if (!authReady || !needsSetup || !portalSession?.accountId) return;
    router.replace(resolveEmployeeFirstLoginHref(portalSession.accountId) as never);
  }, [authReady, needsSetup, portalSession?.accountId, router]);

  if (!authReady) {
    return <LoadingState message="Sitzung wird geprüft…" />;
  }

  if (needsSetup && portalSession?.accountId) {
    return <Redirect href={resolveEmployeeFirstLoginHref(portalSession.accountId) as never} />;
  }

  return <>{children}</>;
}
