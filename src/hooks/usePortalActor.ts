import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth/context';
import { resolveEffectiveRoleKey } from '@/lib/auth/sessionTarget';
import { getPortalDisplayName } from '@/lib/auth/userdisplayname';
import { fetchClientPortalDisplayName } from '@/lib/portal/clientPortalDisplayName';
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
  const [clientDisplayName, setClientDisplayName] = useState<string | null>(null);

  const tenantId = profile?.tenantId ?? portalSession?.tenantId ?? null;
  const roleKey = resolveEffectiveRoleKey(profile, user, portalSession);
  const actorId = profile?.id ?? portalSession?.accountId ?? null;
  const clientId = portalSession?.clientId ?? null;
  const employeeId = portalSession?.employeeId ?? null;

  const fallbackDisplayName = useMemo(
    () => getPortalDisplayName(profile, user, portalSession, 'Portal'),
    [profile, portalSession, user],
  );

  useEffect(() => {
    if (roleKey !== 'client_portal' || !clientId || !tenantId) {
      setClientDisplayName(null);
      return;
    }

    let cancelled = false;

    void fetchClientPortalDisplayName(tenantId, clientId).then((name) => {
      if (!cancelled && name) {
        setClientDisplayName(name);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [roleKey, clientId, tenantId]);

  const displayName = clientDisplayName ?? fallbackDisplayName;

  return useMemo(
    () => ({
      tenantId,
      roleKey,
      actorId,
      clientId,
      employeeId,
      displayName,
      isReady: Boolean(tenantId && roleKey && actorId),
    }),
    [tenantId, roleKey, actorId, clientId, employeeId, displayName],
  );
}
