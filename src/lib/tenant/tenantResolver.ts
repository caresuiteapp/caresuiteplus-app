import type { Profile } from '@/types';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { assertDemoDataNotInProduction, getGlobalEnvironmentMode, isDemo } from '@/lib/environment';
import { getServiceMode } from '@/lib/services/mode';
import { isDemoMode } from '@/lib/supabase/config';

export type TenantResolveResult =
  | { ok: true; tenantId: string }
  | { ok: false; error: string };

/** Synchrone Auflösung — Demo nur wenn isDemoMode(), Live nie DEMO_TENANT_ID-Fallback. */
export function resolveTenantIdForService(profile: Profile | null | undefined): TenantResolveResult {
  if (isDemoMode()) {
    return { ok: true, tenantId: DEMO_TENANT_ID };
  }

  const tenantId = profile?.tenantId?.trim();
  if (!tenantId) {
    return {
      ok: false,
      error: 'Kein Mandant am Profil hinterlegt. Bitte Administrator kontaktieren.',
    };
  }

  return { ok: true, tenantId };
}

export function getCurrentTenantId(profile: Profile | null | undefined): string | null {
  const resolved = resolveTenantIdForService(profile);
  return resolved.ok ? resolved.tenantId : null;
}

export function requireTenantId(profile: Profile | null | undefined): string {
  const resolved = resolveTenantIdForService(profile);
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

  if (getServiceMode() === 'demo' || isDemo()) {
    if (tenantId !== DEMO_TENANT_ID) {
      return { ok: false, error: 'Mandant nicht gefunden.' };
    }
    return null;
  }

  const demoBlock = assertDemoDataNotInProduction(tenantId);
  if (!demoBlock.ok) {
    return { ok: false, error: demoBlock.error };
  }

  if (getGlobalEnvironmentMode() === 'production' && tenantId === DEMO_TENANT_ID) {
    return { ok: false, error: 'Demo-Mandant im Produktionsmodus nicht erlaubt.' };
  }

  return null;
}
