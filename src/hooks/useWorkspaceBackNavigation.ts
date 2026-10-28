import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth/context';
import { resolveAuthSessionTarget } from '@/lib/auth/sessionTarget';

/** Same fallback destination as Web, with the native navigator owning history. */
export function useWorkspaceBackNavigation(fallback?: string) {
  const router = useRouter();
  const auth = useAuth();
  return () => {
    if (router.canGoBack()) router.back();
    else router.replace((fallback ?? (auth.isAuthenticated ? resolveAuthSessionTarget(auth).homePath : '/')) as never);
  };
}
