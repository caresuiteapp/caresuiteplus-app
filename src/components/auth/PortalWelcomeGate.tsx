import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/context';
import { getUserDisplayName } from '@/lib/auth/userdisplayname';
import {
  clearPortalWelcomePending,
  hydratePortalWelcomePending,
  markPortalWelcomeSeen,
  type PortalWelcomeKind,
} from '@/lib/auth/portalWelcomeSession';
import { fetchTenantDisplayName } from '@/lib/tenant/tenantDisplayName';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { usePortalActor } from '@/hooks/usePortalActor';
import { ROLE_LABELS } from '@/data/constants';
import { PortalWelcomeModal } from './PortalWelcomeModal';

const FALLBACK_TENANT = 'Ihr Unternehmen';

function resolvePortalWelcomeKind(
  loginType: string | undefined,
  roleKey: string | null | undefined,
): PortalWelcomeKind | null {
  if (loginType === 'employee_portal' || roleKey === 'employee_portal') return 'employee';
  if (loginType === 'client_portal' || roleKey === 'client_portal' || roleKey === 'family_portal') {
    return 'client';
  }
  return null;
}

/**
 * Mandatory portal welcome — shown after employee or client login until dismissed.
 */
export function PortalWelcomeGate() {
  const { authReady, isAuthenticated, portalSession, profile, user } = useAuth();
  const { displayName, roleKey } = usePortalActor();
  const tenantId = useServiceTenantId();
  const [tenantName, setTenantName] = useState(FALLBACK_TENANT);
  const [showWelcome, setShowWelcome] = useState(false);
  const [welcomeKind, setWelcomeKind] = useState<PortalWelcomeKind | null>(null);

  const portalKind = resolvePortalWelcomeKind(portalSession?.loginType, roleKey);
  const isPortalSession = isAuthenticated && Boolean(portalSession) && Boolean(portalKind);
  const accountId = portalSession?.accountId ?? profile?.id ?? '';

  useEffect(() => {
    if (!authReady || !isPortalSession || !portalKind) {
      setShowWelcome(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      const pending = await hydratePortalWelcomePending();
      if (cancelled || pending !== portalKind) return;
      setWelcomeKind(portalKind);
      setShowWelcome(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [authReady, isPortalSession, portalKind]);

  useEffect(() => {
    if (!tenantId) {
      setTenantName(FALLBACK_TENANT);
      return;
    }

    let cancelled = false;
    void fetchTenantDisplayName(tenantId).then((name) => {
      if (!cancelled && name?.trim()) setTenantName(name);
    });

    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const handleClose = () => {
    if (welcomeKind) {
      void markPortalWelcomeSeen(welcomeKind, accountId);
    } else {
      clearPortalWelcomePending();
    }
    setShowWelcome(false);
  };

  if (!isPortalSession || !welcomeKind) {
    return null;
  }

  const resolvedName = displayName || getUserDisplayName(profile, user, 'Willkommen');
  const roleLabel = roleKey ? (ROLE_LABELS[roleKey] ?? roleKey) : 'Portalzugang';

  return (
    <PortalWelcomeModal
      visible={showWelcome}
      kind={welcomeKind}
      displayName={resolvedName}
      tenantName={tenantName}
      roleLabel={roleLabel}
      avatarUrl={profile?.avatarUrl}
      onClose={handleClose}
    />
  );
}
