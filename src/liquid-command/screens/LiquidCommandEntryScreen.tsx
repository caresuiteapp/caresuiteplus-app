import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth/context';
import { RequireRole } from '@/lib/auth/RequireRole';
import { resolveAuthSessionTarget } from '@/lib/auth/sessionTarget';
import { FullScreenLoader } from '@/components/ui/FullScreenLoader';
import { AccessHubScreen } from './AccessScreens';

export function LiquidCommandEntryScreen() {
  const auth = useAuth();

  if (!auth.authReady) {
    return <FullScreenLoader message="Sitzung wird wiederhergestellt…" />;
  }

  if (!auth.isAuthenticated) return <AccessHubScreen />;

  const { homePath, canRedirectHome } = resolveAuthSessionTarget(auth);
  if (canRedirectHome && homePath !== '/') {
    return <Redirect href={homePath as never} />;
  }

  // Native administration lives in its protected dashboard, not the web desktop.
  // Keep an unresolved restored session behind the existing role recovery gate.
  return <RequireRole><FullScreenLoader message="Zugang wird geprüft…" /></RequireRole>;
}
