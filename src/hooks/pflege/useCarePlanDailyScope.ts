import { useEffect, useRef } from 'react';
import { useCareRuntimePermissions } from './useCareRuntimePermissions';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { woundUuid } from '@/lib/pflege/woundCareDomain';
import type { PermissionKey } from '@/types/permissions';

/** A read/write callback can outlive any render: bind it to one confirmed authorization generation. */
export function useCarePlanDailyScope(routeKey: string) {
  const access = useCareRuntimePermissions(), auth = useAuth(), tenantId = useServiceTenantId();
  const actorId = auth.profile?.id, userId = auth.user?.id, token = auth.session?.accessToken;
  const expiresAt = auth.session?.expiresAt;
  const db = getSupabaseClient();
  const authorize = () => !!db && db === getSupabaseClient() && getServiceMode() === 'supabase'
    && woundUuid(tenantId) && woundUuid(actorId) && woundUuid(userId) && !!token && auth.session?.user.id === userId
    && auth.authReady && auth.isAuthenticated && !auth.isLoading && !auth.profileBootstrapError && !auth.portalSession
    && auth.profile?.tenantId === tenantId && auth.profile?.roleKey === access.roleKey && access.tenantId === tenantId
    && (expiresAt === null || (typeof expiresAt === 'number' && expiresAt > Date.now()))
    && access.hasModuleGate('pflege') && access.can('pflege.access') && access.can('pflege.plans.view');
  const allowed = authorize();
  const key = JSON.stringify([tenantId, actorId, userId, access.roleKey, expiresAt, routeKey]);
  const generation = useRef({ key, token, grants: access.permissions, db, allowed, revision: 0 });
  if (generation.current.key !== key || generation.current.token !== token || generation.current.db !== db
    || generation.current.grants !== access.permissions || generation.current.allowed !== allowed) {
    generation.current = { key, token, grants: access.permissions, db, allowed, revision: generation.current.revision + 1 };
  }
  const captured = generation.current;
  const latest = useRef({ authorize, access });
  latest.current = { authorize, access };
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const isCurrent = () => alive.current && captured === generation.current && captured.allowed && latest.current.authorize();
  const can = (permission: PermissionKey) => isCurrent() && latest.current.access.can(permission);
  return { allowed, tenantId, actorId, access, isCurrent, can, revision: captured.revision };
}
