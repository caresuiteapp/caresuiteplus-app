import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import type { PortalAppointmentItem } from '@/lib/portal';
import { loadPortalAppointmentsWithCache } from '@/lib/offline/assignmentCacheService';
import { useAuth } from '@/lib/auth/context';
import { useConnectivity } from '@/hooks/useConnectivity';
import { usePortalActor } from '@/hooks/usePortalActor';
import { subscribeToEmployeePortalChanges, subscribeToPortalAssistChanges } from '@/lib/realtime';
import { useAsyncQuery } from './core';
import { filterEmployeePortalAppointments } from '@/lib/portal/employeePortalLiveOverviewService';
import { toPortalUserFacingError } from '@/lib/portal/portalUserFacingError';
import {
  isRoleAllowedForPortalAudience,
  type OperationalPortalAudience,
} from '@/lib/portal/portalAudience';

export function usePortalAppointments(audience: OperationalPortalAudience) {
  const { authReady, user } = useAuth();
  const {
    tenantId,
    clientId,
    employeeId,
    actorId,
    roleKey,
    isLinkedReady,
    isResolvingClientLink,
    isResolvingEmployeeLink,
  } = usePortalActor();
  const { isOffline } = useConnectivity();
  const profileId = actorId ?? '';
  const [showSuccess, setShowSuccess] = useState(false);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (successTimer.current) clearTimeout(successTimer.current); }, []);

  const roleMatchesAudience = isRoleAllowedForPortalAudience(roleKey, audience);
  const scopedClientId = audience === 'client' && roleMatchesAudience ? clientId : null;
  const scopedEmployeeId = audience === 'employee' && roleMatchesAudience ? employeeId : null;
  const scopedRoleKey = roleMatchesAudience ? roleKey : null;

  const needsSupabaseSession =
    roleKey === 'client_portal' || roleKey === 'family_portal' || roleKey === 'employee_portal';
  const supabaseSessionReady = !needsSupabaseSession || Boolean(user);
  const queryEnabled =
    authReady && roleMatchesAudience && isLinkedReady && supabaseSessionReady;

  const liveConfig = useMemo(() => {
    if (!tenantId) return undefined;
    if (audience === 'employee' && scopedEmployeeId) {
      return {
        tenantId,
        subscribe: (tid: string, handler: () => void) =>
          subscribeToEmployeePortalChanges(tid, scopedEmployeeId, handler),
      };
    }
    if (audience === 'client' && scopedClientId) {
      return {
        tenantId,
        subscribe: (tid: string, handler: () => void) =>
          subscribeToPortalAssistChanges(tid, scopedClientId, handler),
      };
    }
    return undefined;
  }, [audience, tenantId, scopedEmployeeId, scopedClientId]);

  const isEmployeePortal = audience === 'employee';

  const query = useAsyncQuery(
    async () => {
      const result = await loadPortalAppointmentsWithCache(
        profileId,
        scopedRoleKey,
        tenantId,
        scopedEmployeeId,
        scopedClientId,
        { preferCache: isOffline },
      );
      return result;
    },
    [profileId, scopedRoleKey, tenantId, scopedClientId, scopedEmployeeId, isOffline],
    {
      enabled: queryEnabled,
      queryKey: JSON.stringify([tenantId, profileId, scopedRoleKey, scopedClientId, scopedEmployeeId]),
      live: liveConfig,
      initialCache:
        Platform.OS !== 'web' && queryEnabled
          ? async () => {
              const cached = await loadPortalAppointmentsWithCache(
                profileId,
                scopedRoleKey,
                tenantId,
                scopedEmployeeId,
                scopedClientId,
                { preferCache: true },
              );
              if (cached.ok && cached.fromCache) {
                return cached;
              }
              return null;
            }
          : undefined,
    },
  );
  const cacheMeta = query.cacheMeta;

  const items = useMemo(() => {
    const raw = query.data ?? [];
    return isEmployeePortal ? filterEmployeePortalAppointments(raw) : raw;
  }, [query.data, isEmployeePortal]);

  const refreshQuery = query.refreshWithResult;
  const refresh = useCallback(async () => {
    setShowSuccess(false);
    if (successTimer.current) clearTimeout(successTimer.current);
    const succeeded = await refreshQuery();
    if (!isOffline && succeeded) {
      setShowSuccess(true);
      successTimer.current = setTimeout(() => setShowSuccess(false), 2000);
    }
  }, [refreshQuery, isOffline]);

  const missingClientLink =
    authReady &&
    !isResolvingClientLink &&
    audience === 'client' &&
    roleMatchesAudience &&
    !scopedClientId;

  const portalRoleMismatch = authReady && Boolean(roleKey) && !roleMatchesAudience;
  const missingEmployeeLink = authReady && !isResolvingEmployeeLink && audience === 'employee' && roleMatchesAudience && !scopedEmployeeId;

  return {
    items,
    loading:
      !authReady ||
      (audience === 'client' && isResolvingClientLink) ||
      (audience === 'employee' && Boolean(isResolvingEmployeeLink)) ||
      (queryEnabled && query.loading && items.length === 0),
    error: portalRoleMismatch
      ? 'Diese Sitzung gehört zu einem anderen Portal. Bitte öffnen Sie den für Ihre Anmeldung vorgesehenen Bereich.'
      : missingEmployeeLink
      ? 'Ihr Mitarbeitendenprofil konnte nicht verknüpft werden. Bitte melden Sie sich erneut an.'
      : missingClientLink
      ? 'Klient:innenprofil konnte nicht verknüpft werden. Bitte melden Sie sich erneut an.'
      : query.error
        ? toPortalUserFacingError(
            query.error,
            'Ihre Termine konnten gerade nicht geladen werden. Bitte versuchen Sie es erneut.',
          )
        : null,
    refreshing: query.refreshing,
    refreshError: query.refreshError
      ? toPortalUserFacingError(query.refreshError, 'Die Aktualisierung ist derzeit nicht möglich. Der bisherige Stand bleibt sichtbar.')
      : null,
    showSuccess,
    refresh,
    isEmpty: queryEnabled && !query.loading && !query.error && items.length === 0,
    isLiveConnected: query.isLiveConnected,
    fromCache: cacheMeta.fromCache,
    cachedAt: cacheMeta.cachedAt,
    isLinkedReady,
    isResolvingClientLink,
    missingClientLink,
    portalRoleMismatch,
    supabaseSessionReady,
  };
}

export type { PortalAppointmentItem };
export type { OperationalPortalAudience };
