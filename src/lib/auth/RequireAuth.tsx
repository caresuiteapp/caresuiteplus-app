import { ReactNode, useEffect } from 'react';
import type { Href } from 'expo-router';
import { usePathname, useRouter } from 'expo-router';
import { LoadingState } from '@/components/ui';
import { getLoginRedirectForPath } from '@/lib/navigation';
import { useAuth } from './context';

type RequireAuthProps = {
  children: ReactNode;
  redirectTo?: Href;
  loadingMessage?: string;
};

export function RequireAuth({
  children,
  redirectTo,
  loadingMessage = 'Sitzung wird geprüft…',
}: RequireAuthProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isInitialized, isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isInitialized || isLoading || isAuthenticated) return;
    const target = redirectTo ? String(redirectTo) : getLoginRedirectForPath(pathname);
    router.replace(target as never);
  }, [isAuthenticated, isInitialized, isLoading, pathname, redirectTo, router]);

  if (!isInitialized || isLoading) {
    return <LoadingState message={loadingMessage} />;
  }

  if (!isAuthenticated) {
    return <LoadingState message="Weiterleitung zur Anmeldung…" />;
  }

  return <>{children}</>;
}
