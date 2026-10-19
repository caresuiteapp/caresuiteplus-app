import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth/context';
import { goBackWebPage } from '@/lib/navigation/webNavigationHistory';
import { cancelWebDocumentStartup } from '@/lib/navigation/webDocumentStartup';
import { resolveAuthSessionTarget } from '@/lib/auth/sessionTarget';
import { canLeaveWebPage } from '@/lib/navigation/webPageLeaveGuard.web';

export function webNavigationScope(auth: ReturnType<typeof useAuth>): string {
  return JSON.stringify([auth.user?.id, auth.profile?.id, auth.profile?.tenantId, auth.profile?.roleKey, auth.portalSession?.accountId]);
}

export function useWebBackNavigation(fallback?: string) {
  const router = useRouter();
  const auth = useAuth();
  const scope = webNavigationScope(auth);
  return () => {
    if (!canLeaveWebPage()) return;
    cancelWebDocumentStartup();
    if (auth.isAuthenticated && goBackWebPage(scope)) return;
    if (router.canGoBack()) router.back();
    else router.replace((fallback ?? (auth.isAuthenticated ? resolveAuthSessionTarget(auth).homePath : '/')) as never);
  };
}

