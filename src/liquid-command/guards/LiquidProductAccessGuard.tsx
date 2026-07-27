import { startTransition, useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'expo-router';
import { useHydrated } from '@/hooks/useHydrated';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { checkProductAccess } from '@/lib/navigation';
import { LiquidBackdrop, LiquidState } from '../components/LiquidPrimitives';

export function LiquidProductAccessGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const hydrated = useHydrated();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const decision = checkProductAccess(pathname, profile?.roleKey, tenantId);

  useEffect(() => {
    if (!hydrated || !decision.shouldRedirect) return;
    startTransition(() => router.replace(decision.target));
  }, [decision.shouldRedirect, decision.target, hydrated, router]);

  if (!hydrated) {
    return (
      <LiquidBackdrop>
        <LiquidState
          kind="loading"
          title="Modulzugriff wird geprüft"
          message="Mandant, Rolle und gebuchter Modulumfang werden geladen."
        />
      </LiquidBackdrop>
    );
  }

  if (decision.shouldRedirect) {
    return (
      <LiquidBackdrop>
        <LiquidState
          kind="locked"
          title="Modul nicht aktiv"
          message={decision.message ?? 'Dieses Modul ist für Ihren Mandanten nicht freigeschaltet.'}
          actionLabel="Module verwalten"
          onAction={() => router.replace('/business/modules' as never)}
        />
      </LiquidBackdrop>
    );
  }

  return <>{children}</>;
}
