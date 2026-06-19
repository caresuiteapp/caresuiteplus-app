import type { Profile } from '@/types';
import type { PortalSessionRecord } from '@/lib/auth/portalSessionStore';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { getServiceMode } from '@/lib/services/mode';
import { isDemoMode } from '@/lib/supabase/config';

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
  return { profile: input ?? null, portalSession: null };
}

/** Synchrone Auflösung — Demo nur wenn isDemoMode(), Live nie DEMO_TENANT_ID-Fallback. */
export function resolveTenantIdForService(
  input: Profile | null | undefined | TenantResolveContext,
): TenantResolveResult {
  const { profile, portalSession } = normalizeContext(input);

  if (isDemoMode()) {
    return { ok: true, tenantId: DEMO_TENANT_ID };
  }

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

/** Service-Layer: Mandantenprüfung je nach Modus (Demo = DEMO_TENANT_ID, Live = beliebiger gültiger UUID). */
export function assertTenantForMode(tenantId: string): TenantResolveError | null {
  if (!tenantId?.trim()) {
    return { ok: false, error: 'Mandant fehlt.' };
  }

  if (getServiceMode() === 'demo') {
    if (tenantId !== DEMO_TENANT_ID) {
      return { ok: false, error: 'Mandant nicht gefunden.' };
    }
    return null;
  }

  return null;
}
