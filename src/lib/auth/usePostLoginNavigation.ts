import { useEffect } from 'react';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { useAuth } from './context';

type UsePostLoginNavigationOptions = {
  pendingRoute: Href | null;
  onNavigate?: () => void;
  onClearPending?: () => void;
};

/** Navigate only after AuthProvider has committed user/session to context. */
export function usePostLoginNavigation({
  pendingRoute,
  onNavigate,
  onClearPending,
}: UsePostLoginNavigationOptions): void {
  const router = useRouter();
  const { authReady, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!pendingRoute || !authReady || !isAuthenticated) return;

    router.replace(pendingRoute);
    onNavigate?.();
    onClearPending?.();
  }, [authReady, isAuthenticated, onClearPending, onNavigate, pendingRoute, router]);
}
