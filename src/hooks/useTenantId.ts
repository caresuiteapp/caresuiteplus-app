import { useMemo } from 'react';
import { useAuth } from '@/lib/auth/context';
import {
  getCurrentTenantId,
  requireTenantId,
  resolveTenantIdForService,
  type TenantResolveResult,
} from '@/lib/tenant/tenantResolver';

export function useTenantId(): TenantResolveResult {
  const { profile, portalSession } = useAuth();
  return useMemo(
    () => resolveTenantIdForService({ profile, portalSession }),
    [profile, portalSession],
  );
}

export function useRequiredTenantId(): string {
  const { profile, portalSession } = useAuth();
  return useMemo(() => requireTenantId({ profile, portalSession }), [profile, portalSession]);
}

export function useCurrentTenantId(): string | null {
  const { profile, portalSession } = useAuth();
  return useMemo(() => getCurrentTenantId({ profile, portalSession }), [profile, portalSession]);
}

/** Tenant-ID für Service-Aufrufe — null wenn Live ohne Profil-Mandant. */
export function useServiceTenantId(): string | null {
  const resolved = useTenantId();
  return resolved.ok ? resolved.tenantId : null;
}
