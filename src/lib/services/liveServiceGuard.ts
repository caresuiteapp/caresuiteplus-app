import type { ServiceResult } from '@/types';
import { assertTenantForMode } from '@/lib/tenant/tenantResolver';
import { getServiceMode } from '@/lib/services/mode';

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
