import { ReactNode, startTransition, useEffect } from 'react';
import { usePathname, useRouter } from 'expo-router';
import { ErrorState, LoadingState } from '@/components/ui/StateViews';
import { useHydrated } from '@/hooks/useHydrated';
import { checkProductAccess } from '@/lib/navigation';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';

type RequireProductAccessProps = {
  children: ReactNode;
};

export function RequireProductAccess({ children }: RequireProductAccessProps) {
  const pathname = usePathname();
  const router = useRouter();
  const hydrated = useHydrated();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const decision = checkProductAccess(pathname, profile?.roleKey, tenantId);

  useEffect(() => {
    if (!hydrated || !decision.shouldRedirect) return;
    startTransition(() => {
      router.replace(decision.target);
    });
  }, [decision, hydrated, router]);

  if (!hydrated) {
    return <LoadingState message="Modulzugriff wird geprüft…" />;
  }

  if (decision.shouldRedirect) {
    return (
      <ErrorState
        title="Modul nicht aktiv"
        message={decision.message ?? 'Dieses Modul ist für Ihren Mandanten nicht freigeschaltet.'}
        onRetry={() => router.replace('/business/modules' as never)}
      />
    );
  }

  return <>{children}</>;
}
