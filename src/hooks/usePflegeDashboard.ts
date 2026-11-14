import { useEffect, useRef } from 'react';
import type { PermissionKey } from '@/types/permissions';
import { useAuth } from '@/lib/auth/context';
import { fetchCareOperationalStats } from '@/lib/pflege/careDashboardOperationalService';
import { fetchActiveCarePlans } from '@/lib/pflege/carePlanListService';
import { berlinCalendarDate } from '@/lib/pflege/careTourWorkflow';
import { woundUuid } from '@/lib/pflege/woundCareDomain';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useLocalMinute } from './useLocalMinute';
import { useCareRuntimePermissions } from './pflege/useCareRuntimePermissions';
import { useAsyncQuery } from './core/useAsyncQuery';

const noScope = 'Der aktuelle Zugriff auf die Pflegekennzahlen ist nicht bestätigt.';

export function usePflegeDashboard({ includePlans = false }: { includePlans?: boolean } = {}) {
  const auth = useAuth();
  const tenantId = useServiceTenantId();
  const access = useCareRuntimePermissions();
  const minute = useLocalMinute();
  const day = minute ? berlinCalendarDate(minute) : null;
  const token = auth.session?.accessToken;
  const actorId = auth.profile?.id;
  const authUser = auth.user?.id;
  const expiresAt = auth.session?.expiresAt;
  const scopeKey = JSON.stringify([tenantId, actorId, authUser, auth.profile?.roleKey, access.tenantId, access.roleKey,
    expiresAt, auth.authReady, auth.isAuthenticated, !!auth.portalSession]);
  const confirmed = () => !!token && woundUuid(tenantId) && woundUuid(actorId) && woundUuid(authUser)
    && auth.session?.user.id === authUser && auth.authReady && auth.isAuthenticated && !auth.isLoading
    && !auth.profileBootstrapError && !auth.portalSession && auth.profile?.tenantId === tenantId
    && access.tenantId === tenantId && auth.profile?.roleKey === access.roleKey
    && (expiresAt === null || (typeof expiresAt === 'number' && expiresAt > Date.now()))
    && access.can('pflege.access') && access.hasModuleGate('pflege');
  const enabled = confirmed();
  const boundary = useRef({ key: scopeKey, token, grants: access.permissions, enabled, revision: 0 });
  if (boundary.current.key !== scopeKey || boundary.current.token !== token || boundary.current.grants !== access.permissions || boundary.current.enabled !== enabled) {
    boundary.current = { key: scopeKey, token, grants: access.permissions, enabled, revision: boundary.current.revision + 1 };
  }
  const captured = boundary.current;
  const alive = useRef(true);
  const latestAccess = useRef({ confirmed, access });
  latestAccess.current = { confirmed, access };
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const isScopeCurrent = () => alive.current && captured.enabled && boundary.current === captured && latestAccess.current.confirmed();
  const can = (permission: PermissionKey) => isScopeCurrent() && latestAccess.current.access.can(permission);
  const isCurrentDay = () => isScopeCurrent() && day !== null && day === berlinCalendarDate();
  const readyForPlans = includePlans && enabled && access.can('pflege.plans.view');

  const statsQuery = useAsyncQuery(async () => {
    if (!tenantId || !actorId || !isCurrentDay()) return { ok: false as const, error: noScope };
    return fetchCareOperationalStats({ tenantId, actorId, isCurrent: isCurrentDay, can });
  }, [captured.revision, day], { queryKey: `care-dashboard:${captured.revision}:${day}`, enabled: enabled && !!day, retryCount: 0 });
  const plansQuery = useAsyncQuery(async () => {
    if (!tenantId || !can('pflege.plans.view')) return { ok: false as const, error: noScope };
    const result = await fetchActiveCarePlans(tenantId, access.roleKey);
    return can('pflege.plans.view') ? result : { ok: false as const, error: noScope };
  }, [captured.revision, readyForPlans], { queryKey: `care-dashboard-plans:${captured.revision}`, enabled: readyForPlans, retryCount: 0 });

  const refresh = async () => {
    if (!isScopeCurrent()) { access.refreshPermissions(); return; }
    await Promise.all([statsQuery.refresh(), ...(readyForPlans ? [plansQuery.refresh()] : [])]);
  };
  const safeStats = enabled && statsQuery.data && !statsQuery.previewData && !statsQuery.tableMissing ? statsQuery.data : null;
  const refreshError = enabled ? statsQuery.refreshError : null;
  return {
    access,
    isScopeCurrent,
    stats: refreshError ? null : safeStats,
    activePlans: readyForPlans && !plansQuery.refreshError && !plansQuery.previewData && !plansQuery.tableMissing ? plansQuery.data ?? [] : [],
    loading: access.loading || enabled && (!day || statsQuery.loading),
    error: enabled ? statsQuery.error : access.error ?? (!access.loading ? noScope : null),
    refreshError,
    refreshing: enabled && (statsQuery.refreshing || readyForPlans && plansQuery.refreshing),
    refresh,
  };
}
