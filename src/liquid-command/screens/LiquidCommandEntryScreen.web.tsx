import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth/context';
import { RequireRole } from '@/lib/auth/RequireRole';
import { resolveAuthSessionTarget } from '@/lib/auth/sessionTarget';
import { FullScreenLoader } from '@/components/ui/FullScreenLoader';
import { AccessHubScreen } from './AccessScreens';
import { CommandCenterScreen } from './CommandCenterScreen';

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

  // A failed profile restore must never expose the business desktop while a
  // portal role or password-setup destination is still unknown.
  return <RequireRole><CommandCenterScreen /></RequireRole>;
}
