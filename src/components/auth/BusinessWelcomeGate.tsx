import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/context';
import {
  clearBusinessWelcomePending,
  isBusinessWelcomePending,
} from '@/lib/auth/businessWelcomeSession';
import { getUserDisplayName } from '@/lib/auth/userdisplayname';
import { fetchTenantDisplayName } from '@/lib/tenant/tenantDisplayName';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { BusinessWelcomeModal } from './BusinessWelcomeModal';

const FALLBACK_TENANT = 'Ihr Mandant';

/**
 * Mandatory Verwaltung welcome — shown after every business login until dismissed.
 * Mounted at app root so it works for /business, /office and all admin routes.
 */
export function BusinessWelcomeGate() {
  const { authReady, isAuthenticated, portalSession, profile, user } = useAuth();
  const tenantId = useServiceTenantId();
  const [tenantName, setTenantName] = useState(FALLBACK_TENANT);
  const [showWelcome, setShowWelcome] = useState(false);

  const isBusinessSession = isAuthenticated && !portalSession;

  useEffect(() => {
    if (authReady && isBusinessSession && isBusinessWelcomePending()) {
      setShowWelcome(true);
    }
  }, [authReady, isBusinessSession]);

  useEffect(() => {
    if (!tenantId) {
      setTenantName(FALLBACK_TENANT);
      return;
    }

    let cancelled = false;
    void fetchTenantDisplayName(tenantId).then((name) => {
      if (!cancelled) setTenantName(name);
    });

    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const handleClose = () => {
    clearBusinessWelcomePending();
    setShowWelcome(false);
  };

  if (!isBusinessSession) {
    return null;
  }

  const displayName = getUserDisplayName(profile, user, 'Willkommen');

  return (
    <BusinessWelcomeModal
      visible={showWelcome}
      displayName={displayName}
      tenantName={tenantName}
      onClose={handleClose}
    />
  );
}
