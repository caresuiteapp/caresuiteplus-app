import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth/context';
import { resolveEffectiveRoleKey } from '@/lib/auth/sessionTarget';
import { getPortalDisplayName } from '@/lib/auth/userdisplayname';
import { fetchClientPortalDisplayName, isPortalUsernameLabel } from '@/lib/portal/clientPortalDisplayName';
import { fetchEmployeePortalDisplayName } from '@/lib/portal/employeePortalDisplayName';
import {
  fetchPortalClientIdByAccessAccount,
  fetchPortalClientIdForAuthUser,
} from '@/lib/portal/resolvePortalClientLink';
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
  isResolvingDisplayName: boolean;
  /** True when portal actor has tenant, role, profile and linked client/employee id. */
  isLinkedReady: boolean;
};

export function usePortalActor(): PortalActor {
  const { profile, portalSession, user, updatePortalSession } = useAuth();
  const [clientDisplayName, setClientDisplayName] = useState<string | null>(null);
  const [employeeDisplayName, setEmployeeDisplayName] = useState<string | null>(null);
  const [resolvedClientId, setResolvedClientId] = useState<string | null>(null);
  const [isResolvingClientLink, setIsResolvingClientLink] = useState(false);
  const [isResolvingDisplayName, setIsResolvingDisplayName] = useState(false);

  const isActivePortalSession = Boolean(
    portalSession &&
      (portalSession.roleKey === 'client_portal' ||
        portalSession.roleKey === 'family_portal' ||
        portalSession.roleKey === 'employee_portal'),
  );
  const tenantId = isActivePortalSession
    ? (portalSession?.tenantId ?? profile?.tenantId ?? null)
    : (profile?.tenantId ?? portalSession?.tenantId ?? null);
  const roleKey = resolveEffectiveRoleKey(profile, user, portalSession);
  const actorId = profile?.id ?? portalSession?.accountId ?? null;
  const sessionClientId = portalSession?.clientId ?? null;
  const clientId = sessionClientId ?? resolvedClientId ?? null;
  const employeeId = portalSession?.employeeId ?? null;

  const isClientPortalActor = roleKey === 'client_portal' || roleKey === 'family_portal';

  useEffect(() => {
    if (!isClientPortalActor || sessionClientId || !tenantId) {
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
        const linkedByAuth = await fetchPortalClientIdForAuthUser(tenantId);
        if (cancelled) return;
        if (linkedByAuth) {
          setResolvedClientId(linkedByAuth);
          if (portalSession) {
            void updatePortalSession({ clientId: linkedByAuth });
          }
        }
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
      } else {
        const linkedByAuth = await fetchPortalClientIdForAuthUser(tenantId);
        if (!cancelled && linkedByAuth) {
          setResolvedClientId(linkedByAuth);
          if (portalSession) {
            void updatePortalSession({ clientId: linkedByAuth });
          }
        }
      }

      setIsResolvingClientLink(false);
    })();

    return () => {
      cancelled = true;
      setIsResolvingClientLink(false);
    };
  }, [isClientPortalActor, sessionClientId, tenantId, portalSession, updatePortalSession]);

  const fallbackDisplayName = useMemo(() => {
    const isClientPortal = roleKey === 'client_portal' || roleKey === 'family_portal';
    return getPortalDisplayName(profile, user, portalSession, isClientPortal ? '' : 'Willkommen');
  }, [profile, portalSession, roleKey, user]);

  useEffect(() => {
    if (roleKey !== 'client_portal' && roleKey !== 'family_portal') {
      setClientDisplayName(null);
      setIsResolvingDisplayName(false);
      return;
    }
    if (!clientId || !tenantId) {
      setClientDisplayName(null);
      setIsResolvingDisplayName(false);
      return;
    }

    let cancelled = false;
    setIsResolvingDisplayName(true);

    void fetchClientPortalDisplayName(tenantId, clientId).then((name) => {
      if (cancelled) return;
      if (name) {
        setClientDisplayName(name);
      }
      setIsResolvingDisplayName(false);
    });

    return () => {
      cancelled = true;
      setIsResolvingDisplayName(false);
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
    fallbackDisplayName ||
    'Klient:in';

  return useMemo(() => {
    const isReady = Boolean(tenantId && roleKey && actorId);
    const isLinkedReady =
      isReady &&
      !isResolvingClientLink &&
      ((roleKey === 'client_portal' || roleKey === 'family_portal'
        ? Boolean(clientId)
        : roleKey === 'employee_portal'
          ? Boolean(employeeId)
          : true));

    return {
      tenantId,
      roleKey,
      actorId,
      clientId,
      employeeId,
      displayName,
      isReady,
      isResolvingClientLink,
      isResolvingDisplayName,
      isLinkedReady,
    };
  }, [
    tenantId,
    roleKey,
    actorId,
    clientId,
    employeeId,
    displayName,
    isResolvingClientLink,
    isResolvingDisplayName,
  ]);
}

