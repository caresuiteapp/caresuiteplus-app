import { useCallback, useMemo, useState } from 'react';
import type { PortalAppointmentItem } from '@/lib/portal';
import { loadPortalAppointmentsWithCache } from '@/lib/offline/assignmentCacheService';
import type { AssignmentCacheMeta } from '@/lib/offline/types';
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
  } = usePortalActor();
  const { isOffline } = useConnectivity();
  const profileId = actorId ?? '';
  const [showSuccess, setShowSuccess] = useState(false);
  const [cacheMeta, setCacheMeta] = useState<AssignmentCacheMeta>({
    fromCache: false,
    cachedAt: null,
  });

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
      setCacheMeta({ fromCache: result.fromCache, cachedAt: result.cachedAt });
      return result;
    },
    [profileId, scopedRoleKey, tenantId, scopedClientId, scopedEmployeeId, isOffline],
    { enabled: queryEnabled, live: liveConfig },
  );

  const items = useMemo(() => {
    const raw = query.data ?? [];
    return isEmployeePortal ? filterEmployeePortalAppointments(raw) : raw;
  }, [query.data, isEmployeePortal]);

  const refresh = useCallback(async () => {
    await query.refresh();
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  }, [query]);

  const missingClientLink =
    authReady &&
    !isResolvingClientLink &&
    audience === 'client' &&
    roleMatchesAudience &&
    !scopedClientId;

  const portalRoleMismatch = authReady && Boolean(roleKey) && !roleMatchesAudience;

  return {
    items,
    loading:
      !authReady ||
      (audience === 'client' && isResolvingClientLink) ||
      (queryEnabled && query.loading && items.length === 0),
    error: portalRoleMismatch
      ? 'Diese Sitzung gehört zu einem anderen Portal. Bitte öffnen Sie den für Ihre Anmeldung vorgesehenen Bereich.'
      : missingClientLink
      ? 'Klient:innenprofil konnte nicht verknüpft werden. Bitte melden Sie sich erneut an.'
      : query.error
        ? toPortalUserFacingError(
            query.error,
            'Ihre Termine konnten gerade nicht geladen werden. Bitte versuchen Sie es erneut.',
          )
        : null,
    refreshing: query.refreshing,
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
