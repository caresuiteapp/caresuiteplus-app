import { useMemo } from 'react';
import { useAuth } from '@/lib/auth/context';
import {
  assertConnectFeatureAllowed,
  buildConnectFeatureGateContextFromFeatureKey,
} from '@/lib/connect/gateway/connectFeatureGate';
import { getPermissionsForRole } from '@/lib/permissions/staticRolePermissions';
import type {
  ConnectFeatureActionKey,
  ConnectFeatureGateContext,
  ConnectFeatureGateResult,
  ConnectFeatureKey,
} from '@/types/connect/featureGate';

export function useConnectFeatureGate(
  featureKey: ConnectFeatureKey,
  actionKey: ConnectFeatureActionKey,
  overrides: Partial<ConnectFeatureGateContext> = {},
): {
  result: ConnectFeatureGateResult;
  context: ConnectFeatureGateContext;
  allowed: boolean;
  showBlockPage: boolean;
} {
  const { profile, user } = useAuth();
  const roleKey = profile?.roleKey ?? null;
  const permissions = roleKey ? getPermissionsForRole(roleKey) : [];

  const context = useMemo(
    () =>
      buildConnectFeatureGateContextFromFeatureKey(featureKey, {
        userId: user?.id ?? profile?.id ?? null,
        tenantId: profile?.tenantId ?? null,
        role: roleKey,
        permissions,
        ...overrides,
      }),
    [featureKey, user?.id, profile?.id, profile?.tenantId, roleKey, overrides],
  );

  const result = useMemo(
    () => assertConnectFeatureAllowed(featureKey, actionKey, context),
    [featureKey, actionKey, context],
  );

  return {
    result,
    context,
    allowed: result.allowed,
    showBlockPage: !result.allowed && 'showBlockPage' in result && result.showBlockPage,
  };
}
