import { useMemo } from 'react';
import { useAuth } from '@/lib/auth/context';
import type { RoleKey } from '@/types';

export type PortalActor = {
  tenantId: string | null;
  roleKey: RoleKey | null;
  actorId: string | null;
  clientId: string | null;
  employeeId: string | null;
  displayName: string;
  isReady: boolean;
};

export function usePortalActor(): PortalActor {
  const { profile, portalSession, user } = useAuth();

  return useMemo(() => {
    const tenantId = profile?.tenantId ?? portalSession?.tenantId ?? null;
    const roleKey = profile?.roleKey ?? portalSession?.roleKey ?? null;
    const actorId = profile?.id ?? portalSession?.accountId ?? null;
    const clientId = portalSession?.clientId ?? null;
    const employeeId = portalSession?.employeeId ?? null;
    const displayName = profile?.displayName ?? user?.displayName ?? 'Portal';

    return {
      tenantId,
      roleKey,
      actorId,
      clientId,
      employeeId,
      displayName,
      isReady: Boolean(tenantId && roleKey && actorId),
    };
  }, [profile, portalSession, user]);
}
