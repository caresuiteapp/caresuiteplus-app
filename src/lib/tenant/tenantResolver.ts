import type { Profile } from '@/types';
import type { PortalSessionRecord } from '@/lib/auth/portalSessionStore';

export type TenantResolveResult =
  | { ok: true; tenantId: string }
  | { ok: false; error: string };

export type TenantResolveContext = {
  profile?: Profile | null;
  portalSession?: PortalSessionRecord | null;
};

function normalizeContext(
  input: Profile | null | undefined | TenantResolveContext,
): TenantResolveContext {
  if (input && typeof input === 'object' && 'portalSession' in input) {
    return input;
  }
  return { profile: (input as Profile | null | undefined) ?? null, portalSession: null };
}

/** Resolve tenant from authenticated profile or portal session — live-only, no demo fallback. */
export function resolveTenantIdForService(
  input: Profile | null | undefined | TenantResolveContext,
): TenantResolveResult {
  const { profile, portalSession } = normalizeContext(input);

  const tenantId = profile?.tenantId?.trim() || portalSession?.tenantId?.trim();
  if (!tenantId) {
    return {
      ok: false,
      error: 'Kein Mandant am Profil hinterlegt. Bitte Administrator kontaktieren.',
    };
  }

  return { ok: true, tenantId };
}

export function getCurrentTenantId(
  input: Profile | null | undefined | TenantResolveContext,
): string | null {
  const resolved = resolveTenantIdForService(input);
  return resolved.ok ? resolved.tenantId : null;
}

export function requireTenantId(input: Profile | null | undefined | TenantResolveContext): string {
  const resolved = resolveTenantIdForService(input);
  if (!resolved.ok) {
    throw new Error(resolved.error);
  }
  return resolved.tenantId;
}

export type TenantResolveError = { ok: false; error: string };

/** Service-Layer: Mandantenprüfung — tenant id must be present. */
export function assertTenantForMode(tenantId: string): TenantResolveError | null {
  if (!tenantId?.trim()) {
    return { ok: false, error: 'Mandant fehlt.' };
  }

  return null;
}
