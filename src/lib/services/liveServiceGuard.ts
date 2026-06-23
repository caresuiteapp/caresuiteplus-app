import type { ServiceResult } from '@/types';
import {
  assertDemoDataNotInProduction,
  assertTenantAllowedForMode,
  toGuardBlock,
} from '@/lib/environment';
import { getServiceMode } from '@/lib/services/mode';
import { assertTenantForMode } from '@/lib/tenant/tenantResolver';

/** Mandantenprüfung für Live-Services. */
export function guardServiceTenant(tenantId: string): { ok: false; error: string } | null {
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) {
    return { ok: false, error: tenantErr.error };
  }

  const demoBlock = toGuardBlock(assertDemoDataNotInProduction(tenantId));
  if (demoBlock) return demoBlock;

  const modeBlock = toGuardBlock(assertTenantAllowedForMode(tenantId));
  if (modeBlock) return modeBlock;

  return null;
}

/** Blockiert Features ohne Supabase-Anbindung im Live-Modus. */
export function blockDemoOnlyInLiveMode<T>(featureLabel: string): ServiceResult<T> | null {
  if (getServiceMode() === 'supabase') {
    return {
      ok: false,
      error: `${featureLabel} im Live-Modus noch nicht vollständig angebunden.`,
    };
  }
  return null;
}

/** Verhindert Demo-Seed-Daten im Supabase-Modus. */
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

/** Mandantenprüfung + Live-Blocker für noch nicht angebundene Features. */
export function guardLiveDemoFeature<T>(
  tenantId: string,
  featureLabel: string,
): ServiceResult<T> | null {
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  return blockDemoOnlyInLiveMode<T>(featureLabel);
}
