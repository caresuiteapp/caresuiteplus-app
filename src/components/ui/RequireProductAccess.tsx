import { ReactNode, useEffect } from 'react';
import { usePathname, useRouter } from 'expo-router';
import { ErrorState } from '@/components/ui/StateViews';
import { checkProductAccess } from '@/lib/navigation';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';

type RequireProductAccessProps = {
  children: ReactNode;
};

export function RequireProductAccess({ children }: RequireProductAccessProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const decision = checkProductAccess(pathname, profile?.roleKey, tenantId);

  useEffect(() => {
    if (!decision.shouldRedirect) return;
    router.replace(decision.target);
  }, [decision, router]);

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
