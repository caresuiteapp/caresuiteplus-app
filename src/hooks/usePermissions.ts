import { useEffect, useMemo, useState } from 'react';
import type { PermissionDecision, PermissionKey } from '@/types/permissions';
import { ROLE_LABELS } from '@/data/constants';
import { checkPermissionWithList, getPermissionsForRole, hasAllPermissionsInList, hasAnyPermissionInList, hasPermissionInList } from '@/lib/permissions';
import { hasEffectiveModuleGateAccess } from '@/lib/modules/moduleAccessService';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { isDemoMode } from '@/lib/supabase/config';
import { fetchRuntimePermissions } from '@/lib/supabase/permissionRepository';
import { useAuth } from '@/lib/auth/context';
import { resolveEffectiveRoleKey } from '@/lib/auth/sessionTarget';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { portalEmployeeSessionSignature } from '@/lib/auth/verifiedPortalEmployeeLink';

const NO_PERMISSIONS: readonly PermissionKey[] = [];

export function usePermissions() {
  const { profile, user, portalSession, session } = useAuth();
  const roleKey = resolveEffectiveRoleKey(profile, user, portalSession);
  const serviceTenantId = useServiceTenantId();
  const tenantId = serviceTenantId ?? (isDemoMode() ? DEMO_TENANT_ID : '');

  const demo = isDemoMode();
  const scope = JSON.stringify([tenantId, roleKey, profile?.id, user?.id, portalSession?.accountId, portalSession?.sessionToken, portalEmployeeSessionSignature(session), session?.expiresAt, demo]);
  const [resolved, setResolved] = useState<{ scope: string; permissions: readonly PermissionKey[] } | null>(null);
  const demoPermissions = useMemo(() => roleKey ? getPermissionsForRole(roleKey) : NO_PERMISSIONS, [roleKey]);
  const permissions = demo ? demoPermissions : resolved?.scope === scope ? resolved.permissions : NO_PERMISSIONS;

  useEffect(() => {
    if (!roleKey || demo) return;
    let current = true;
    void fetchRuntimePermissions(roleKey, tenantId || null, scope).then(
      permissions => { if (current) setResolved({ scope, permissions }); },
      () => { if (current) setResolved({ scope, permissions: NO_PERMISSIONS }); },
    );
    return () => { current = false; };
  }, [roleKey, tenantId, scope, demo]);

  return useMemo(
    () => ({
      roleKey,
      roleLabel: roleKey ? ROLE_LABELS[roleKey] : null,
      permissions,
      can: (permission: PermissionKey) => hasPermissionInList(permissions, permission),
      canAny: (keys: PermissionKey[]) => hasAnyPermissionInList(permissions, keys),
      canAll: (keys: PermissionKey[]) => hasAllPermissionsInList(permissions, keys),
      check: (permission: PermissionKey): PermissionDecision =>
        checkPermissionWithList(roleKey, permissions, permission),
      /** Modul-Gate: Produkt aktiv (Assist impliziert Office), unabhängig von Rollenrechten. */
      hasModuleGate: (moduleKey: import('@/types').ProductKey) =>
        tenantId ? hasEffectiveModuleGateAccess(moduleKey, tenantId) : false,
      isReadOnly:
        hasPermissionInList(permissions, 'office.clients.view') &&
        !hasPermissionInList(permissions, 'office.clients.edit'),
      tenantId: tenantId || null,
    }),
    [roleKey, permissions, tenantId],
  );
}
