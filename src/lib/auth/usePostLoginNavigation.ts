import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from './context';

type StableRouteTarget = string | Record<string, unknown>;

type StableRouter = {
  replace: (target: StableRouteTarget) => void;
};

type UsePostLoginNavigationOptions = {
  pendingRoute: StableRouteTarget | null;
  onNavigate?: () => void;
  onClearPending?: () => void;
};

/** Navigate only after AuthProvider has committed user/session to context. */
export function usePostLoginNavigation({
  pendingRoute,
  onNavigate,
  onClearPending,
}: UsePostLoginNavigationOptions): void {
  const router = useRouter() as unknown as StableRouter;
  const { authReady, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!pendingRoute || !authReady || !isAuthenticated) return;

    router.replace(pendingRoute);
    onNavigate?.();
    onClearPending?.();
  }, [authReady, isAuthenticated, onClearPending, onNavigate, pendingRoute, router]);
}
