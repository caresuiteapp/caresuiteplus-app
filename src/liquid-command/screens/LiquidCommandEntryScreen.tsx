import { useAuth } from '@/lib/auth';
import { AccessHubScreen } from './AccessScreens';
import { CommandCenterScreen } from './CommandCenterScreen';
import { PortalHomeScreen } from './PortalHomeScreen';
import { LiquidBackdrop, LiquidState } from '../components/LiquidPrimitives';

export function LiquidCommandEntryScreen() {
  const { authReady, isAuthenticated, portalSession, profile } = useAuth();

  if (!authReady) {
    return (
      <LiquidBackdrop>
        <LiquidState
          kind="loading"
          title="System wird gestartet"
          message="Sitzung, Rolle und Mandantenkontext werden sicher wiederhergestellt."
        />
      </LiquidBackdrop>
    );
  }

  if (!isAuthenticated) return <AccessHubScreen />;

  const roleKey = portalSession?.roleKey ?? profile?.roleKey ?? null;
  if (roleKey === 'employee_portal') return <PortalHomeScreen portal="employee" />;
  if (roleKey === 'client_portal') return <PortalHomeScreen portal="client" />;
  if (roleKey === 'family_portal') return <PortalHomeScreen portal="family" />;

  return <CommandCenterScreen />;
}
