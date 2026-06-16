import type { ServiceResult } from '@/types';
import {
  assertTenantAllowedForMode,
  canUseDemoFallback,
  getMode,
  toGuardBlock,
} from '@/lib/environment';
import { assertTenantForMode } from '@/lib/tenant/tenantResolver';
import { getServiceMode } from '@/lib/services/mode';

/** Mandantenprüfung für Services — Demo nur DEMO_TENANT_ID, Production ohne Demo-Daten. */
export function guardServiceTenant(tenantId: string): { ok: false; error: string } | null {
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) {
    return { ok: false, error: tenantErr.error };
  }

  const envBlock = toGuardBlock(assertTenantAllowedForMode(tenantId));
  if (envBlock) {
    return { ok: false, error: envBlock.error };
  }

  return null;
}

/** Verhindert Demo-Fallbacks wenn der Betriebsmodus sie nicht erlaubt. */
export function blockDemoOnlyInLiveMode<T>(featureLabel: string): ServiceResult<T> | null {
  if (canUseDemoFallback()) {
    return null;
  }

  if (getServiceMode() === 'supabase' || getMode() !== 'demo') {
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
  const liveBlock = blockDemoOnlyInLiveMode<T>(featureLabel);
  if (liveBlock) return liveBlock;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  return null;
}
