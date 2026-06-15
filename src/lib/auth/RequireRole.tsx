import { ReactNode, useEffect } from 'react';
import { usePathname, useRouter } from 'expo-router';
import { ErrorState } from '@/components/ui';
import { checkRoleAccess } from '@/lib/navigation';
import { useAuth } from './context';

type RequireRoleProps = {
  children: ReactNode;
};

export function RequireRole({ children }: RequireRoleProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, isLoading, isAuthenticated } = useAuth();

  const decision = checkRoleAccess(pathname, profile?.roleKey ?? null);

  useEffect(() => {
    if (isLoading || !isAuthenticated || !decision.shouldRedirect) return;
    router.replace(decision.target);
  }, [decision, isAuthenticated, isLoading, router]);

  if (isLoading) return null;

  if (decision.shouldRedirect) {
    return (
      <ErrorState
        title="Kein Zugriff"
        message={decision.message ?? 'Sie haben keine Berechtigung für diesen Bereich.'}
        onRetry={() => router.replace('/' as never)}
      />
    );
  }

  return <>{children}</>;
}
