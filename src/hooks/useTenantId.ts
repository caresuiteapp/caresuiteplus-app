import { useMemo } from 'react';
import { useAuth } from '@/lib/auth/context';
import {
  getCurrentTenantId,
  requireTenantId,
  resolveTenantIdForService,
  type TenantResolveResult,
} from '@/lib/tenant/tenantResolver';

export function useTenantId(): TenantResolveResult {
  const { profile } = useAuth();
  return useMemo(() => resolveTenantIdForService(profile), [profile]);
}

export function useRequiredTenantId(): string {
  const { profile } = useAuth();
  return useMemo(() => requireTenantId(profile), [profile]);
}

export function useCurrentTenantId(): string | null {
  const { profile } = useAuth();
  return useMemo(() => getCurrentTenantId(profile), [profile]);
}

/** Tenant-ID für Service-Aufrufe — null wenn Live ohne Profil-Mandant. */
export function useServiceTenantId(): string | null {
  const resolved = useTenantId();
  return resolved.ok ? resolved.tenantId : null;
}
