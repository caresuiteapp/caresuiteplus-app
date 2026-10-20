import { sharedPortalRead } from '@/lib/portal/sharedPortalRead';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth/context';
import { resolveEffectiveRoleKey } from '@/lib/auth/sessionTarget';
import { getPortalDisplayName } from '@/lib/auth/userdisplayname';
import { fetchClientPortalDisplayName, isPortalUsernameLabel } from '@/lib/portal/clientPortalDisplayName';
import { fetchEmployeePortalDisplayName } from '@/lib/portal/employeePortalDisplayName';
import {
  fetchPortalClientIdByAccessAccount,
  fetchPortalClientIdForAuthUser,
} from '@/lib/portal/resolvePortalClientLink';
import {
  fetchPortalEmployeeIdByAccessAccount,
  fetchPortalEmployeeIdForAuthUser,
  resolvePortalEmployeeLinkForAuthUser,
} from '@/lib/portal/resolvePortalEmployeeLink';
import { getSession } from '@/lib/supabase';
import { getServiceMode } from '@/lib/services/mode';
import { useConnectivity } from '@/hooks/useConnectivity';
import { createVerifiedPortalEmployeeLink, readVerifiedPortalEmployeeLink, portalEmployeeSessionSignature } from '@/lib/auth/verifiedPortalEmployeeLink';
import {
  buildClientPortalActorScope,
  isClientPortalScopeId,
} from '@/lib/portal/clientPortalActorScope';
import { fetchCurrentFamilyPortalAccessScope } from '@/lib/portal/resolveFamilyPortalAccess';
import type { FamilyPortalAccessScope } from '@/lib/portal/familyPortalAccessScope';
import type { RoleKey } from '@/types';

function normalizePortalActorLabel(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

export type PortalActor = {
  tenantId: string | null;
  roleKey: RoleKey | null;
  actorId: string | null;
  clientId: string | null;
  employeeId: string | null;
  familyAccess: FamilyPortalAccessScope | null;
  displayName: string;
  isReady: boolean;
  isResolvingClientLink: boolean;
  isResolvingEmployeeLink: boolean;
  isResolvingDisplayName: boolean;
  /** True when portal actor has tenant, role, profile and linked client/employee id. */
  isLinkedReady: boolean;
  /** A previous server verification permits cache reads, never live writes. */
  employeeLinkReadOnly?: boolean;
  employeeLinkVerifiedAt?: string | null;
};

export function selectPortalEmployeeId(
  sessionEmployeeId: string | null | undefined,
  profileEmployeeId: string | null | undefined,
  resolvedEmployeeId: string | null | undefined,
): string | null {
  return (
    sessionEmployeeId?.trim() ||
    profileEmployeeId?.trim() ||
    resolvedEmployeeId?.trim() ||
    null
  );
}

export function usePortalActor(): PortalActor {
  const { profile, portalSession, user, session, updatePortalSession } = useAuth();
  const { isOffline } = useConnectivity();
  const [identityClock, setIdentityClock] = useState(() => Date.now());
  const [clientDisplayName, setClientDisplayName] = useState<string | null>(null);
  const [employeeDisplayName, setEmployeeDisplayName] = useState<string | null>(null);
  const [resolvedClientId, setResolvedClientId] = useState<string | null>(null);
  const [resolvedEmployeeId, setResolvedEmployeeId] = useState<string | null>(null);
  const [familyAccess, setFamilyAccess] = useState<FamilyPortalAccessScope | null>(null);
  const [isResolvingClientLink, setIsResolvingClientLink] = useState(false);
  const [isResolvingEmployeeLink, setIsResolvingEmployeeLink] = useState(false);
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
  const actorId = isActivePortalSession
    ? (portalSession?.accountId ?? profile?.id ?? null)
    : (profile?.id ?? portalSession?.accountId ?? null);
  const identity = `${tenantId}:${actorId}:${roleKey}:${user?.id ?? ''}:${portalSession?.sessionToken ?? ''}:${portalEmployeeSessionSignature(session) ?? ''}`;
  const priorIdentity = useRef(identity);
  const identityChanged = priorIdentity.current !== identity;
  if (identityChanged) {
    priorIdentity.current = identity;
    setResolvedClientId(null);
    setResolvedEmployeeId(null);
    setFamilyAccess(null);
    setClientDisplayName(null);
    setEmployeeDisplayName(null);
  }
  const sessionClientId = portalSession?.clientId ?? null;
  const activeResolvedClientId = identityChanged ? null : resolvedClientId;
  const isLivePortal = getServiceMode() === 'supabase';
  const clientId = isLivePortal
    ? activeResolvedClientId ?? null
    : sessionClientId ?? activeResolvedClientId ?? null;
  const sessionEmployeeId = portalSession?.employeeId ?? null;
  const profileEmployeeId = profile?.employeeId?.trim() || null;
  const isEmployeePortalActor = roleKey === 'employee_portal' || roleKey === 'caregiver' || roleKey === 'nurse';
  const verifyEmployeeLink = getServiceMode() === 'supabase';
  const offlineLink = verifyEmployeeLink && isOffline
    ? readVerifiedPortalEmployeeLink(portalSession, user, session)
    : null;
  const employeeLinkReadOnly = Boolean(offlineLink);
  const employeeLinkVerifiedAt = offlineLink?.verifiedAt ?? null;
  // Local links can outlive an account reassignment. Only the authenticated
  // canonical server link may publish a live employee identity.
  const employeeId = !isEmployeePortalActor ? null : verifyEmployeeLink
    ? isOffline ? offlineLink?.employeeId ?? null : resolvedEmployeeId
    : selectPortalEmployeeId(sessionEmployeeId, profileEmployeeId, resolvedEmployeeId);

  const isClientPortalActor = roleKey === 'client_portal' || roleKey === 'family_portal';

  const offlineLinkExpiresAt = offlineLink?.expiresAt;
  useEffect(() => {
    if (!offlineLinkExpiresAt) return;
    const timeout = setTimeout(() => setIdentityClock(Date.now()), Math.min(
      86_400_000, Math.max(0, Date.parse(offlineLinkExpiresAt) - Date.now()),
    ));
    return () => clearTimeout(timeout);
  }, [offlineLinkExpiresAt, identityClock]);

  useEffect(() => {
    if (!isClientPortalActor || !isClientPortalScopeId(tenantId) || !isLivePortal) {
      setIsResolvingClientLink(false);
      setFamilyAccess(null);
      return;
    }

    let cancelled = false;
    setIsResolvingClientLink(true);

    void (async () => {
      let portalAccountId = portalSession?.accountId ?? null;

      if (!isClientPortalScopeId(portalAccountId)) {
        const sessionResult = await getSession();
        const metaAccountId = sessionResult.ok
          ? sessionResult.data?.user.app_metadata?.portal_account_id
          : null;
        if (typeof metaAccountId === 'string' && metaAccountId.trim()) {
          portalAccountId = metaAccountId.trim();
        }
      }

      if (!portalAccountId) {
        setResolvedClientId(null);
        setFamilyAccess(null);
        setIsResolvingClientLink(false);
        return;
      }

      if (roleKey === 'family_portal') {
        const familyScope = await fetchCurrentFamilyPortalAccessScope(tenantId, portalAccountId);
        if (cancelled) return;
        if (!familyScope) {
          setResolvedClientId(null);
          setFamilyAccess(null);
          setIsResolvingClientLink(false);
          return;
        }
        setResolvedClientId(familyScope.clientId);
        setFamilyAccess(familyScope);
        if (
          portalSession &&
          (sessionClientId !== familyScope.clientId ||
            portalSession.relativeContactId !== familyScope.relativeContactId)
        ) {
          void updatePortalSession({
            clientId: familyScope.clientId,
            relativeContactId: familyScope.relativeContactId,
          });
        }
        setIsResolvingClientLink(false);
        return;
      }

      setFamilyAccess(null);

      const linkedByAccount = await fetchPortalClientIdByAccessAccount(tenantId, portalAccountId);
      if (cancelled) return;

      const linkedClientId =
        linkedByAccount ?? (await fetchPortalClientIdForAuthUser(tenantId));
      if (cancelled) return;

      try {
        const scope = buildClientPortalActorScope({
          tenantId,
          accountId: portalAccountId,
          roleKey,
          cachedClientId: sessionClientId,
          linkedClientId: linkedClientId ?? '',
        });
        setResolvedClientId(scope.clientId);
        if (portalSession && !scope.cachedLinkMatches) {
          void updatePortalSession({ clientId: scope.clientId });
        }
      } catch {
        setResolvedClientId(null);
        setFamilyAccess(null);
      }

      setIsResolvingClientLink(false);
    })();

    return () => {
      cancelled = true;
      setIsResolvingClientLink(false);
    };
  }, [
    isClientPortalActor,
    isLivePortal,
    roleKey,
    sessionClientId,
    tenantId,
    portalSession?.accountId,
    portalSession?.relativeContactId,
    updatePortalSession,
  ]);

  const employeeIdentityInput = useRef({ portalSession, user, session, sessionEmployeeId, profileEmployeeId });
  employeeIdentityInput.current = { portalSession, user, session, sessionEmployeeId, profileEmployeeId };
  useEffect(() => {
    const { portalSession, user, session, sessionEmployeeId, profileEmployeeId } = employeeIdentityInput.current;
    if (!isEmployeePortalActor || !tenantId ||
        (!verifyEmployeeLink && (sessionEmployeeId || profileEmployeeId))) {
      setIsResolvingEmployeeLink(false);
      return;
    }
    if (verifyEmployeeLink && isOffline) {
      setResolvedEmployeeId(null);
      setIsResolvingEmployeeLink(false);
      return;
    }

    let cancelled = false;
    setIsResolvingEmployeeLink(true);

    void sharedPortalRead(JSON.stringify(['employee-link', identity]), async () => {
      if (verifyEmployeeLink) return resolvePortalEmployeeLinkForAuthUser(tenantId);
      const accountId = portalSession?.accountId?.trim() || null;
      const linkedByAccount = accountId
        ? await fetchPortalEmployeeIdByAccessAccount(tenantId, accountId)
        : null;
      const employeeId = linkedByAccount ?? (await fetchPortalEmployeeIdForAuthUser(tenantId));
      return employeeId ? { status: 'verified' as const, employeeId, authUserId: user?.id } : { status: 'unavailable' as const };
    }).then((result) => {
      if (cancelled) return;
      const linkedEmployeeId = result.status === 'verified' &&
        (!verifyEmployeeLink || result.authUserId === user?.id) ? result.employeeId : null;
      setResolvedEmployeeId(linkedEmployeeId);
      if (result.status === 'denied' && portalSession?.employeeLinkVerification) {
        void updatePortalSession({ employeeLinkVerification: null });
      }
      if (linkedEmployeeId && portalSession) {
        const verification = createVerifiedPortalEmployeeLink(linkedEmployeeId, portalSession, user, session);
        if (verification) {
          void updatePortalSession({ employeeId: linkedEmployeeId, employeeLinkVerification: verification });
        } else if (linkedEmployeeId !== sessionEmployeeId) {
          void updatePortalSession({ employeeId: linkedEmployeeId });
        }
      }
    }).catch(() => {
      if (!cancelled) setResolvedEmployeeId(null);
    }).finally(() => {
      if (!cancelled) setIsResolvingEmployeeLink(false);
    });

    return () => {
      cancelled = true;
      setIsResolvingEmployeeLink(false);
    };
  }, [identity, isEmployeePortalActor, verifyEmployeeLink, tenantId, isOffline, updatePortalSession]);

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

    void sharedPortalRead(JSON.stringify(['client-name', tenantId, actorId, clientId]), () => fetchClientPortalDisplayName(tenantId, clientId)).then((name) => {
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
  }, [roleKey, clientId, tenantId, actorId]);

  useEffect(() => {
    if (roleKey !== 'employee_portal' || !employeeId || !tenantId) {
      setEmployeeDisplayName(null);
      return;
    }

    let cancelled = false;

    void sharedPortalRead(JSON.stringify(['employee-name', tenantId, actorId, employeeId]), () => fetchEmployeePortalDisplayName(tenantId, employeeId)).then((name) => {
      if (!cancelled && name) {
        setEmployeeDisplayName(name);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [roleKey, employeeId, tenantId, actorId]);

  const displayName =
    clientDisplayName ??
    employeeDisplayName ??
    (portalSession?.displayName &&
    !isPortalUsernameLabel(portalSession.displayName) &&
    normalizePortalActorLabel(portalSession.displayName) !==
      normalizePortalActorLabel(portalSession.tenantName)
      ? portalSession.displayName.trim()
      : null) ??
    (fallbackDisplayName &&
    normalizePortalActorLabel(fallbackDisplayName) !==
      normalizePortalActorLabel(portalSession?.tenantName)
      ? fallbackDisplayName
      : null) ??
    'Klient:in';

  return useMemo(() => {
    const isReady = Boolean(tenantId && roleKey && actorId);
    const isLinkedReady =
      isReady &&
      !isResolvingClientLink &&
      !isResolvingEmployeeLink &&
      ((roleKey === 'client_portal' || roleKey === 'family_portal'
        ? Boolean(clientId)
        : isEmployeePortalActor
          ? Boolean(employeeId)
          : true));

    return {
      tenantId,
      roleKey,
      actorId,
      clientId,
      employeeId,
      familyAccess,
      displayName,
      isReady,
      isResolvingClientLink,
      isResolvingEmployeeLink,
      isResolvingDisplayName,
      isLinkedReady,
      employeeLinkReadOnly,
      employeeLinkVerifiedAt,
    };
  }, [
    tenantId,
    roleKey,
    actorId,
    clientId,
    employeeId,
    familyAccess,
    displayName,
    isResolvingClientLink,
    isResolvingEmployeeLink,
    isResolvingDisplayName,
    isEmployeePortalActor,
    employeeLinkReadOnly,
    employeeLinkVerifiedAt,
  ]);
}
