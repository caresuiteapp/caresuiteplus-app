import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth/context';
import { resolveEffectiveRoleKey } from '@/lib/auth/sessionTarget';
import { getPortalDisplayName } from '@/lib/auth/userdisplayname';
import { fetchClientPortalDisplayName, isPortalUsernameLabel } from '@/lib/portal/clientPortalDisplayName';
import { fetchEmployeePortalDisplayName } from '@/lib/portal/employeePortalDisplayName';
import { fetchPortalClientIdByAccessAccount } from '@/lib/portal/resolvePortalClientLink';
import { getSession } from '@/lib/supabase';
import type { RoleKey } from '@/types';
export type PortalActor = {
  tenantId: string | null;
  roleKey: RoleKey | null;
  actorId: string | null;
  clientId: string | null;
  employeeId: string | null;
  displayName: string;
  isReady: boolean;
  isResolvingClientLink: boolean;
};

export function usePortalActor(): PortalActor {
  const { profile, portalSession, user, updatePortalSession } = useAuth();
  const [clientDisplayName, setClientDisplayName] = useState<string | null>(null);
  const [employeeDisplayName, setEmployeeDisplayName] = useState<string | null>(null);
  const [resolvedClientId, setResolvedClientId] = useState<string | null>(null);
  const [isResolvingClientLink, setIsResolvingClientLink] = useState(false);

  const tenantId = profile?.tenantId ?? portalSession?.tenantId ?? null;
  const roleKey = resolveEffectiveRoleKey(profile, user, portalSession);
  const actorId = profile?.id ?? portalSession?.accountId ?? null;
  const sessionClientId = portalSession?.clientId ?? null;
  const clientId = sessionClientId ?? resolvedClientId ?? null;
  const employeeId = portalSession?.employeeId ?? null;

  useEffect(() => {
    if (roleKey !== 'client_portal' || sessionClientId || !tenantId) {
      setIsResolvingClientLink(false);
      return;
    }

    let cancelled = false;
    setIsResolvingClientLink(true);

    void (async () => {
      let portalAccountId = portalSession?.accountId ?? null;

      if (!portalAccountId) {
        const sessionResult = await getSession();
        const metaAccountId = sessionResult.ok
          ? sessionResult.data?.user.app_metadata?.portal_account_id
          : null;
        if (typeof metaAccountId === 'string' && metaAccountId.trim()) {
          portalAccountId = metaAccountId.trim();
        }
      }

      if (!portalAccountId) {
        if (!cancelled) setIsResolvingClientLink(false);
        return;
      }

      const linkedClientId = await fetchPortalClientIdByAccessAccount(tenantId, portalAccountId);
      if (cancelled) return;

      if (linkedClientId) {
        setResolvedClientId(linkedClientId);
        if (portalSession) {
          void updatePortalSession({ clientId: linkedClientId });
        }
      }

      setIsResolvingClientLink(false);
    })();

    return () => {
      cancelled = true;
      setIsResolvingClientLink(false);
    };
  }, [roleKey, sessionClientId, tenantId, portalSession, updatePortalSession]);

  const fallbackDisplayName = useMemo(
    () => getPortalDisplayName(profile, user, portalSession, 'Willkommen'),
    [profile, portalSession, user],
  );

  useEffect(() => {
    if (roleKey !== 'client_portal' || !clientId || !tenantId) {
      setClientDisplayName(null);
      return;
    }

    let cancelled = false;

    void fetchClientPortalDisplayName(tenantId, clientId).then((name) => {
      if (!cancelled && name) {
        setClientDisplayName(name);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [roleKey, clientId, tenantId]);

  useEffect(() => {
    if (roleKey !== 'employee_portal' || !employeeId || !tenantId) {
      setEmployeeDisplayName(null);
      return;
    }

    let cancelled = false;

    void fetchEmployeePortalDisplayName(tenantId, employeeId).then((name) => {
      if (!cancelled && name) {
        setEmployeeDisplayName(name);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [roleKey, employeeId, tenantId]);

  const displayName =
    clientDisplayName ??
    employeeDisplayName ??
    (portalSession?.displayName && !isPortalUsernameLabel(portalSession.displayName)
      ? portalSession.displayName.trim()
      : null) ??
    fallbackDisplayName;

  return useMemo(
    () => ({
      tenantId,
      roleKey,
      actorId,
      clientId,
      employeeId,
      displayName,
      isReady: Boolean(tenantId && roleKey && actorId),
      isResolvingClientLink,
    }),
    [tenantId, roleKey, actorId, clientId, employeeId, displayName, isResolvingClientLink],
  );
}

