import { isDemoSupabaseTenantId } from '@/data/constants/demoGuard';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import type {
  EnvironmentGuardCode,
  EnvironmentGuardResult,
  EnvironmentMode,
  ProviderEnvironment,
  ProviderEnvironmentDisplay,
} from '@/types/environment';
import { ENVIRONMENT_MODE_LABELS, ENVIRONMENT_MODE_RULES, isValidEnvironmentMode } from './environmentModeCatalog';
import { logEnvironmentAuditEvent } from './environmentAuditService';
import {
  getTenantEnvironmentSettings,
  isDemoDataTenant,
} from './tenantEnvironmentSettingsService';

const GLOBAL_MODE_ENV = 'EXPO_PUBLIC_ENVIRONMENT_MODE';

function resolveGlobalModeFromEnv(): EnvironmentMode | null {
  const raw = process.env[GLOBAL_MODE_ENV]?.trim().toLowerCase();
  return isValidEnvironmentMode(raw) ? raw : null;
}

/** Globaler App-Modus aus Env — Standard ist Produktion. */
export function getGlobalEnvironmentMode(): EnvironmentMode {
  const configured = resolveGlobalModeFromEnv();
  if (configured) return configured;
  return 'production';
}

/** Effektiver Modus — Mandanteneinstellung hat Vorrang, sonst global. */
export function getEffectiveEnvironmentMode(tenantId?: string | null): EnvironmentMode {
  if (tenantId) {
    const tenantSettings = getTenantEnvironmentSettings(tenantId);
    if (tenantSettings?.mode) {
      return tenantSettings.mode;
    }
  }
  return getGlobalEnvironmentMode();
}

export function getMode(tenantId?: string | null): EnvironmentMode {
  return getEffectiveEnvironmentMode(tenantId);
}

export function isDemo(tenantId?: string | null): boolean {
  return getMode(tenantId) === 'demo';
}

export function isProduction(tenantId?: string | null): boolean {
  return getMode(tenantId) === 'production';
}

export function isSandbox(tenantId?: string | null): boolean {
  return getMode(tenantId) === 'sandbox';
}

export function isPilot(tenantId?: string | null): boolean {
  return getMode(tenantId) === 'pilot';
}

export function isInternalTest(tenantId?: string | null): boolean {
  return getMode(tenantId) === 'internal_test';
}

export function canUseMockProvider(tenantId?: string | null): boolean {
  return ENVIRONMENT_MODE_RULES[getMode(tenantId)].allowsMockProviders;
}

export function canUseDemoFallback(tenantId?: string | null): boolean {
  return ENVIRONMENT_MODE_RULES[getMode(tenantId)].allowsDemoFallback;
}

export function canUseRealProviders(tenantId?: string | null): boolean {
  const mode = getMode(tenantId);
  return mode === 'production' || mode === 'pilot';
}

export function shouldShowDemoBanner(tenantId?: string | null): boolean {
  const mode = getMode(tenantId);
  return ENVIRONMENT_MODE_RULES[mode].requiresBanner && mode === 'demo';
}

export function shouldShowEnvironmentBanner(tenantId?: string | null): boolean {
  const mode = getMode(tenantId);
  return ENVIRONMENT_MODE_RULES[mode].requiresBanner;
}

export function shouldShowPilotBanner(tenantId: string): boolean {
  const settings = getTenantEnvironmentSettings(tenantId);
  return settings?.isPilotTenant === true || isPilot(tenantId);
}

export function getEnvironmentBannerLabel(tenantId?: string | null): string | null {
  const mode = getMode(tenantId);
  if (!ENVIRONMENT_MODE_RULES[mode].requiresBanner) return null;

  if (mode === 'demo') {
    return 'Demo-Modus — keine echten Daten, keine produktiven Anbieter.';
  }
  if (mode === 'sandbox') {
    return 'Sandbox — Provider-Tests, nicht als Produktion darstellen.';
  }
  if (mode === 'pilot') {
    const settings = tenantId ? getTenantEnvironmentSettings(tenantId) : null;
    const phase = settings?.pilotPhase ? ` (${settings.pilotPhase})` : '';
    return `Pilotbetrieb${phase} — begrenzter Rollout mit bekannten Risiken.`;
  }
  if (mode === 'internal_test') {
    return 'Interner Test — keine Live-Daten.';
  }
  return null;
}

export function assertDemoDataNotInProduction(tenantId: string): EnvironmentGuardResult {
  const globalMode = getGlobalEnvironmentMode();
  const isDemoTenant =
    tenantId === DEMO_TENANT_ID || isDemoSupabaseTenantId(tenantId) || isDemoDataTenant(tenantId);

  if (globalMode === 'production' && isDemoTenant) {
    logEnvironmentAuditEvent({
      tenantId,
      eventType: 'demo_data_blocked',
      mode: globalMode,
      summary: 'Demo-Daten im Produktionsmodus blockiert.',
      metadata: { tenantId, scope: 'global' },
    });
    return {
      ok: false,
      error: 'Demo-Daten im Produktionsmodus nicht erlaubt.',
      code: 'demo_data_in_production',
    };
  }

  const effectiveMode = getEffectiveEnvironmentMode(tenantId);
  if (effectiveMode === 'production' && isDemoTenant) {
    logEnvironmentAuditEvent({
      tenantId,
      eventType: 'demo_data_blocked',
      mode: effectiveMode,
      summary: 'Demo-Daten im Produktionsmodus blockiert.',
      metadata: { tenantId, scope: 'tenant' },
    });
    return {
      ok: false,
      error: 'Demo-Daten im Produktionsmodus nicht erlaubt.',
      code: 'demo_data_in_production',
    };
  }

  return { ok: true };
}

export function assertMockProviderAllowed(
  isMockProvider: boolean,
  providerEnvironment: ProviderEnvironment = 'sandbox',
  tenantId?: string | null,
): EnvironmentGuardResult {
  if (!isMockProvider) {
    return { ok: true };
  }

  const mode = tenantId ? getMode(tenantId) : getGlobalEnvironmentMode();
  const blockInMode = !canUseMockProvider(tenantId ?? undefined);
  const blockInProviderEnv = providerEnvironment === 'production';

  if (blockInMode || blockInProviderEnv) {
    logEnvironmentAuditEvent({
      tenantId: tenantId ?? null,
      eventType: 'mock_provider_blocked',
      mode,
      summary: 'Mock-Anbieter im Produktions-/Pilot-Modus blockiert.',
      metadata: {
        isMockProvider: 'true',
        providerEnvironment,
      },
    });
    return {
      ok: false,
      error: 'Mock-Anbieter in diesem Betriebsmodus blockiert.',
      code: 'mock_provider_in_production',
    };
  }

  return { ok: true };
}

export function assertDemoFallbackAllowed(
  usesDemoFallback: boolean,
  tenantId?: string | null,
): EnvironmentGuardResult {
  if (!usesDemoFallback) return { ok: true };

  const mode = getMode(tenantId);
  if (!canUseDemoFallback(tenantId)) {
    logEnvironmentAuditEvent({
      tenantId: tenantId ?? null,
      eventType: 'demo_fallback_blocked',
      mode,
      summary: 'Demo-Fallback im Produktionsmodus blockiert.',
    });
    return {
      ok: false,
      error: 'Demo-Fallback im Produktionsmodus blockiert.',
      code: 'demo_fallback_in_production',
    };
  }

  return { ok: true };
}

export function assertTenantAllowedForMode(tenantId: string): EnvironmentGuardResult {
  if (!tenantId?.trim()) {
    return { ok: false, error: 'Mandant fehlt.', code: 'invalid_tenant_for_mode' };
  }

  const mode = getEffectiveEnvironmentMode(tenantId);

  if (mode === 'demo' && tenantId !== DEMO_TENANT_ID) {
    return { ok: false, error: 'Mandant nicht gefunden.', code: 'invalid_tenant_for_mode' };
  }

  const demoBlock = assertDemoDataNotInProduction(tenantId);
  if (!demoBlock.ok) return demoBlock;

  logEnvironmentAuditEvent({
    tenantId,
    eventType: 'mode_resolved',
    mode,
    summary: `Betriebsmodus ${ENVIRONMENT_MODE_LABELS[mode]} für Mandant aufgelöst.`,
  });

  return { ok: true };
}

/** Provider-Umgebung für UI — Sandbox nie als Produktion labeln. */
export function resolveProviderDisplayEnvironment(
  providerEnvironment: ProviderEnvironment,
  tenantId?: string | null,
): ProviderEnvironmentDisplay {
  const mode = getMode(tenantId);

  if (providerEnvironment === 'sandbox') {
    logEnvironmentAuditEvent({
      tenantId: tenantId ?? null,
      eventType: 'provider_sandbox_labeled',
      mode,
      summary: 'Provider-Sandbox korrekt als nicht-produktiv gekennzeichnet.',
      metadata: { providerEnvironment },
    });
    return {
      environment: 'sandbox',
      label: mode === 'sandbox' ? 'Sandbox (Test)' : 'Sandbox — nicht produktiv',
      isProductionClaim: false,
    };
  }

  if (providerEnvironment === 'demo') {
    return {
      environment: 'demo',
      label: 'Demo — simuliert',
      isProductionClaim: false,
    };
  }

  if (providerEnvironment === 'production' && mode !== 'production') {
    return {
      environment: providerEnvironment,
      label: 'Nicht produktiv freigegeben',
      isProductionClaim: false,
    };
  }

  return {
    environment: 'production',
    label: 'Produktion',
    isProductionClaim: mode === 'production',
  };
}

export function mapWorkspaceEnvironment(
  tenantId?: string | null,
): 'demo' | 'production' {
  const mode = getMode(tenantId);
  return mode === 'production' || mode === 'pilot' ? 'production' : 'demo';
}

export type EnvironmentGuardBlock = { ok: false; error: string; code?: EnvironmentGuardCode };

export function toGuardBlock(result: EnvironmentGuardResult): EnvironmentGuardBlock | null {
  return result.ok ? null : result;
}
