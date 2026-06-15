import { ReactNode, useEffect } from 'react';
import { usePathname, useRouter } from 'expo-router';
import { ErrorState } from '@/components/ui/StateViews';
import { checkModuleAccess } from '@/lib/navigation';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';

type RequireModuleVisibilityProps = {
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
      return 'Zugriff nicht möglich';
  }
}

export function RequireModuleVisibility({ children }: RequireModuleVisibilityProps) {
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
        message={decision.message ?? 'Dieser Bereich ist derzeit nicht verfügbar.'}
        onRetry={() => router.replace('/business' as never)}
      />
    );
  }

  return <>{children}</>;
}
