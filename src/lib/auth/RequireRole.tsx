import { ReactNode, useEffect } from 'react';
import { usePathname, useRouter } from 'expo-router';
import { ErrorState } from '@/components/ui';
import { checkRoleAccess } from '@/lib/navigation';
import { resolveSessionHomeRoute } from '@/lib/navigation/sessionRouting';
import { useAuth } from './context';

type RequireRoleProps = {
  children: ReactNode;
};

export function RequireRole({ children }: RequireRoleProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, portalSession, isLoading, isAuthenticated } = useAuth();
  const sessionHome = resolveSessionHomeRoute(profile?.roleKey ?? null, portalSession);
  const sessionHomePath = String(sessionHome);

  const decision = checkRoleAccess(pathname, profile?.roleKey ?? null, {
    tenantId: profile?.tenantId ?? null,
    userId: profile?.id ?? null,
  });

  useEffect(() => {
    if (isLoading || !isAuthenticated || !decision.shouldRedirect) return;
    const target =
      decision.reason === 'wrong_role' ? sessionHomePath : String(decision.target);
    router.replace(target as never);
  }, [decision, isAuthenticated, isLoading, router, sessionHomePath]);

  if (isLoading) return null;

  if (decision.shouldRedirect) {
    const retryTarget = isAuthenticated ? sessionHomePath : '/';
    return (
      <ErrorState
        title="Kein Zugriff"
        message={decision.message ?? 'Sie haben keine Berechtigung für diesen Bereich.'}
        onRetry={() => router.replace(retryTarget as never)}
      />
    );
  }

  return <>{children}</>;
}
