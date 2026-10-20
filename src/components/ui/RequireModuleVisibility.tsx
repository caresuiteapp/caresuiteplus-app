import { BUSINESS_HOME_ROUTE } from '@/lib/navigation/businessHome';
import { ReactNode, useEffect } from 'react';
import { runAppTransition } from '@/lib/react/runAppTransition';
import { usePathname, useRouter } from 'expo-router';
import { ErrorState, LoadingState } from '@/components/ui/StateViews';
import { useHydrated } from '@/hooks/useHydrated';
import { checkModuleAccess } from '@/lib/navigation';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';

type RequireModuleVisibilityProps = {
  children: ReactNode;
};

type StableRouter = { replace: (target: string) => void };

function titleForReason(reason?: string): string {
  switch (reason) {
    case 'module_coming_soon':
      return 'Modul in Vorbereitung';
    case 'module_internal':
      return 'Interner Bereich';
    case 'module_disabled':
      return 'Modul nicht verfügbar';
    case 'module_inactive':
      return 'Modul nicht aktiv';
    default:
      return 'Zugriff nicht möglich';
  }
}

export function RequireModuleVisibility({ children }: RequireModuleVisibilityProps) {
  const pathname = usePathname();
  const router = useRouter() as unknown as StableRouter;
  const hydrated = useHydrated();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const decision = checkModuleAccess(pathname, profile?.roleKey, tenantId);

  useEffect(() => {
    if (!hydrated || !decision.shouldRedirect) return;
    runAppTransition(() => {
      router.replace(decision.target);
    });
  }, [decision, hydrated, router]);

  if (!hydrated) {
    return <LoadingState message="Modulzugriff wird geprüft…" />;
  }

  if (decision.shouldRedirect) {
    return (
      <ErrorState
        title={titleForReason(decision.reason)}
        message={decision.message ?? 'Dieser Bereich ist derzeit nicht verfügbar.'}
        onRetry={() => router.replace(BUSINESS_HOME_ROUTE as never)}
      />
    );
  }

  return <>{children}</>;
}
