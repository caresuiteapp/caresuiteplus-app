import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth/context';
import { LiquidBackdrop, LiquidState } from '@/liquid-command/components/LiquidPrimitives';
import { PortalAccessHubScreen } from './PortalAccessHubScreen';

const PORTAL_ROLE_KEYS = new Set(['employee_portal', 'client_portal']);

export function PortalAppEntryScreen() {
  const auth = useAuth();
  const signOut = auth.signOut;
  const roleKey = auth.portalSession?.roleKey ?? auth.profile?.roleKey ?? null;
  const invalidAuthenticatedRole =
    auth.authReady && auth.isAuthenticated && !PORTAL_ROLE_KEYS.has(roleKey ?? '');

  useEffect(() => {
    if (!invalidAuthenticatedRole) return;
    void signOut();
  }, [invalidAuthenticatedRole, signOut]);

  if (!auth.authReady || invalidAuthenticatedRole) {
    return (
      <LiquidBackdrop>
        <LiquidState
          kind="loading"
          title="Portal-App wird gestartet"
          message="Sitzung und Portalrolle werden sicher geprüft."
        />
      </LiquidBackdrop>
    );
  }

  if (!auth.isAuthenticated) return <PortalAccessHubScreen />;
  if (roleKey === 'employee_portal') return <Redirect href="/portal/employee" />;
  if (roleKey === 'client_portal') return <Redirect href="/portal/client" />;

  return <PortalAccessHubScreen />;
}
