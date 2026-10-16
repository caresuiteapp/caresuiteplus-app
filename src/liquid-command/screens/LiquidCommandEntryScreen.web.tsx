import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth/context';
import { resolveAuthSessionTarget } from '@/lib/auth/sessionTarget';
import { FullScreenLoader } from '@/components/ui/FullScreenLoader';
import { SessionAccessRecovery } from '@/lib/auth/SessionAccessRecovery.web';
import { AccessHubScreen } from './AccessScreens';

export function LiquidCommandEntryScreen() {
  const auth = useAuth();
  if (!auth.authReady) {
    return <FullScreenLoader message={auth.isInitialized ? 'Abmeldung wird abgeschlossen…' : 'Sitzung wird wiederhergestellt…'} />;
  }
  if (!auth.isAuthenticated) return <AccessHubScreen />;

  const { homePath, canRedirectHome } = resolveAuthSessionTarget(auth);
  if (!canRedirectHome) return <SessionAccessRecovery />;
  return <Redirect href={homePath as never} />;
}
