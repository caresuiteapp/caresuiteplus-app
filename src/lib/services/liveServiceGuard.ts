import type { ServiceResult } from '@/types';
import { getServiceMode } from '@/lib/services/mode';
import { assertTenantForMode } from '@/lib/tenant/tenantResolver';

/** Mandantenprüfung für Services — Demo nur DEMO_TENANT_ID, Live beliebige UUID. */
export function guardServiceTenant(tenantId: string): { ok: false; error: string } | null {
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) {
    return { ok: false, error: tenantErr.error };
  }
  return null;
}

/** Verhindert Demo-Daten im Live-Modus ohne Supabase-Anbindung. */
export function blockDemoOnlyInLiveMode<T>(featureLabel: string): ServiceResult<T> | null {
  if (getServiceMode() === 'supabase') {
    return {
      ok: false,
      error: `${featureLabel} im Live-Modus noch nicht vollständig angebunden.`,
    };
  }
  return null;
}

/**
 * Guard for code paths that must never serve demo seed data in supabase mode.
 * Returns a ServiceResult error when live mode would incorrectly use demo data.
 */
export function assertLiveDataPath(featureLabel: string): ServiceResult<never> | null {
  if (getServiceMode() === 'supabase') {
    return {
      ok: false,
      error: `${featureLabel}: Demo-Daten im Live-Modus blockiert.`,
    };
  }
  return null;
}

export function isLiveServiceMode(): boolean {
  return getServiceMode() === 'supabase';
}

/** Mandantenprüfung + Live-Blocker für Demo-only Features ohne Supabase-Anbindung. */
export function guardLiveDemoFeature<T>(
  tenantId: string,
  featureLabel: string,
): ServiceResult<T> | null {
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  return blockDemoOnlyInLiveMode<T>(featureLabel);
}
