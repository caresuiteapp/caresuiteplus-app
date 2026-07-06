import { useEffect, useMemo, useState } from 'react';
import type { RoleKey } from '@/types';
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

export function usePermissions() {
  const { profile, user, portalSession } = useAuth();
  const roleKey = resolveEffectiveRoleKey(profile, user, portalSession);
  const serviceTenantId = useServiceTenantId();
  const tenantId = serviceTenantId ?? (isDemoMode() ? DEMO_TENANT_ID : '');

  const [permissions, setPermissions] = useState<readonly PermissionKey[]>(() =>
    getPermissionsForRole(roleKey),
  );

  useEffect(() => {
    if (!roleKey) {
      setPermissions([]);
      return;
    }
    if (isDemoMode()) {
      setPermissions(getPermissionsForRole(roleKey));
      return;
    }
    void fetchRuntimePermissions(roleKey, tenantId || null).then(setPermissions);
  }, [roleKey, tenantId]);

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
