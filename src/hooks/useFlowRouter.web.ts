import { useCallback, useMemo } from 'react';
import { usePathname, useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth/context';
import { canGoBackWebPage, goBackWebPage } from '@/lib/navigation/webNavigationHistory';
import { resolveHealthOSPopupFallbackPath } from '@/lib/navigation/healthosRoutePresentation';
import { webNavigationScope } from './useWebBackNavigation.web';
import { cancelWebDocumentStartup } from '@/lib/navigation/webDocumentStartup';

/** One Back contract for every Web screen; native uses Expo's router unchanged. */
export function useFlowRouter() {
  const router = useRouter();
  const pathname = usePathname();
  const auth = useAuth();
  const scope = webNavigationScope(auth);
  const back = useCallback(() => {
    cancelWebDocumentStartup();
    if (auth.isAuthenticated && goBackWebPage(scope)) return;
    if (router.canGoBack()) router.back();
    else router.replace(resolveHealthOSPopupFallbackPath(pathname) as never);
  }, [auth.isAuthenticated, pathname, router, scope]);
  const canGoBack = useCallback(() => router.canGoBack() || (auth.isAuthenticated && canGoBackWebPage(scope)), [auth.isAuthenticated, router, scope]);
  return useMemo(() => ({ ...router, back, canGoBack }), [back, canGoBack, router]);
}
