import { ReactNode, useEffect } from 'react';
import { usePathname, useRouter } from 'expo-router';
import { ErrorState } from '@/components/ui/StateViews';
import { checkModuleAccess } from '@/lib/navigation';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';

type RequireProductAccessProps = {
  children: ReactNode;
};

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
      return 'Modul nicht aktiv';
  }
}

export function RequireProductAccess({ children }: RequireProductAccessProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const decision = checkModuleAccess(pathname, profile?.roleKey, tenantId);

  useEffect(() => {
    if (!decision.shouldRedirect) return;
    router.replace(decision.target);
  }, [decision, router]);

  if (decision.shouldRedirect) {
    return (
      <ErrorState
        title={titleForReason(decision.reason)}
        message={decision.message ?? 'Dieses Modul ist für Ihren Mandanten nicht freigeschaltet.'}
        onRetry={() => router.replace('/business/modules' as never)}
      />
    );
  }

  return <>{children}</>;
}
