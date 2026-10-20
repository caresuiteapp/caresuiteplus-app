import { ReactNode, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { ErrorState } from '@/components/ui';
import { canAccessDeveloperTools } from './devAccess';
import { useAuth } from './context';

type RequireDevOrAdminProps = {
  children: ReactNode;
};

export function RequireDevOrAdmin({ children }: RequireDevOrAdminProps) {
  const router = useRouter();
  const { profile, isLoading, isAuthenticated } = useAuth();
  const allowed = canAccessDeveloperTools(profile?.roleKey ?? null);

  useEffect(() => {
    if (isLoading || allowed) return;
    if (!__DEV__ && !isAuthenticated) {
      router.replace('/auth/business-login' as never);
    }
  }, [allowed, isAuthenticated, isLoading, router]);

  if (isLoading && !__DEV__) return null;

  if (!allowed) {
    return (
      <ErrorState
        title="Kein Zugriff"
        message="Entwicklerwerkzeuge sind nur für Administratoren verfügbar."
        onRetry={() => router.replace('/' as never)}
      />
    );
  }

  return <>{children}</>;
}
