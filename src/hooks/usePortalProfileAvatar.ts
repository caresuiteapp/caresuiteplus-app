import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth/context';
import { fetchEmployeePortalAvatar } from '@/lib/portal/employeePortalAvatar';
import { usePortalActor } from '@/hooks/usePortalActor';

export type PortalProfileAvatar = {
  avatarUrl: string | undefined;
  avatarVersion: string | undefined;
  isReady: boolean;
};

/**
 * Resolves portal header avatar: employee record first, then auth user profile.
 * Cache-bust version prefers employee updated_at, then profile.updatedAt.
 */
export function usePortalProfileAvatar(): PortalProfileAvatar {
  const { profile } = useAuth();
  const { roleKey, tenantId, employeeId, actorId } = usePortalActor();
  const avatarScope = JSON.stringify([roleKey, tenantId, actorId, employeeId]);
  const [employeeAvatar, setEmployeeAvatar] = useState<{
    scope: string;
    avatarUrl: string | null;
    updatedAt: string | null;
  } | null>(null);

  useEffect(() => {
    if (roleKey !== 'employee_portal' || !employeeId || !tenantId) {
      setEmployeeAvatar(null);
      return;
    }

    let cancelled = false;

    void fetchEmployeePortalAvatar(tenantId, employeeId).then((result) => {
      if (!cancelled) {
        setEmployeeAvatar(result ? { ...result, scope: avatarScope } : null);
      }
    }).catch(() => { if (!cancelled) setEmployeeAvatar(null); });

    return () => {
      cancelled = true;
    };
  }, [roleKey, employeeId, tenantId, avatarScope, profile?.avatarUrl, profile?.updatedAt]);

  return useMemo(() => {
    const userAvatar = profile?.avatarUrl?.trim() || undefined;
    const currentEmployeeAvatar = employeeAvatar?.scope === avatarScope ? employeeAvatar : null;
    const employeeUrl = currentEmployeeAvatar?.avatarUrl?.trim() || undefined;
    const avatarUrl = employeeUrl ?? userAvatar;
    const avatarVersion =
      currentEmployeeAvatar?.updatedAt ??
      profile?.updatedAt ??
      profile?.avatarUrl ??
      undefined;

    return {
      avatarUrl,
      avatarVersion,
      isReady: Boolean(profile),
    };
  }, [employeeAvatar, avatarScope, profile]);
}
