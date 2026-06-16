import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import {
  assertDemoDataNotInProduction,
  assertDemoFallbackAllowed,
  assertMockProviderAllowed,
  assertTenantAllowedForMode,
  canUseMockProvider,
  getEnvironmentAuditTrail,
  getEnvironmentBannerLabel,
  getMode,
  getTenantEnvironmentSettings,
  isDemo,
  isProduction,
  resetEnvironmentAuditStore,
  resetTenantEnvironmentSettingsStore,
  resolveProviderDisplayEnvironment,
  shouldShowDemoBanner,
  shouldShowPilotBanner,
} from '@/lib/environment';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { assertTenantForMode } from '@/lib/tenant/tenantResolver';
import { isPdfProductionAvailable } from '@/lib/documents/pdfRenderJobService';

const root = path.join(__dirname, '..', '..', '..');
const migrationPath = path.join(root, 'supabase/migrations/0056_environment_modes_prepared.sql');
const LIVE_TENANT = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const PILOT_TENANT = 'tenant-pilot-ambulant-001';

function stubLiveProductionEnv() {
  vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
  vi.stubEnv('EXPO_PUBLIC_ENVIRONMENT_MODE', 'production');
}

function stubDemoEnv() {
  vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
  vi.stubEnv('EXPO_PUBLIC_ENVIRONMENT_MODE', 'demo');
}

describe('0056_environment_modes_prepared migration', () => {
  const sql = readFileSync(migrationPath, 'utf8');

  it('legt alle fünf Umgebungstabellen an', () => {
    for (const table of [
      'environment_modes',
      'tenant_environment_settings',
      'demo_data_sets',
      'pilot_readiness_checks',
      'environment_audit_events',
    ]) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`);
    }
  });

  it('definiert alle fünf Betriebsmodi', () => {
    for (const mode of ['demo', 'sandbox', 'pilot', 'internal_test', 'production']) {
      expect(sql).toContain(`'${mode}'`);
    }
  });

  it('aktiviert RLS auf allen Tabellen', () => {
    for (const table of [
      'environment_modes',
      'tenant_environment_settings',
      'demo_data_sets',
      'pilot_readiness_checks',
      'environment_audit_events',
    ]) {
      expect(sql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
    }
  });
});

describe('Environment mode separation', () => {
  beforeEach(() => {
    resetEnvironmentAuditStore();
    resetTenantEnvironmentSettingsStore();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('1 — Demo-Modus: nur Demo-Mandant, Banner sichtbar, Mock-Provider erlaubt', () => {
    stubDemoEnv();

    expect(getMode()).toBe('demo');
    expect(isDemo()).toBe(true);
    expect(shouldShowDemoBanner()).toBe(true);
    expect(getEnvironmentBannerLabel()).toContain('Demo-Modus');
    expect(canUseMockProvider()).toBe(true);

    expect(assertTenantAllowedForMode(DEMO_TENANT_ID).ok).toBe(true);
    expect(assertTenantAllowedForMode(LIVE_TENANT).ok).toBe(false);
    expect(assertTenantForMode(DEMO_TENANT_ID)).toBeNull();
    expect(assertTenantForMode(LIVE_TENANT)?.error).toContain('Mandant nicht gefunden');
  });

  it('2 — Produktion: Demo-Daten und DEMO_TENANT_ID blockiert', () => {
    stubLiveProductionEnv();

    expect(isProduction()).toBe(true);
    expect(assertDemoDataNotInProduction(DEMO_TENANT_ID).ok).toBe(false);
    expect(assertTenantForMode(DEMO_TENANT_ID)?.error).toContain('Demo');
    expect(guardServiceTenant(DEMO_TENANT_ID)?.error).toContain('Demo');
    expect(assertTenantAllowedForMode(LIVE_TENANT).ok).toBe(true);
    expect(guardServiceTenant(LIVE_TENANT)).toBeNull();
  });

  it('3 — Produktion: Mock-Provider blockiert, Sandbox korrekt gekennzeichnet', () => {
    stubLiveProductionEnv();

    expect(canUseMockProvider()).toBe(false);
    expect(assertMockProviderAllowed(true, 'sandbox', LIVE_TENANT).ok).toBe(false);
    expect(assertMockProviderAllowed(false, 'sandbox', LIVE_TENANT).ok).toBe(true);

    const display = resolveProviderDisplayEnvironment('sandbox', LIVE_TENANT);
    expect(display.isProductionClaim).toBe(false);
    expect(display.label).toContain('Sandbox');
  });

  it('4 — Produktion: Demo-Fallback blockiert, simulierte PDF-Engine nicht produktiv', () => {
    stubLiveProductionEnv();

    expect(assertDemoFallbackAllowed(true, LIVE_TENANT).ok).toBe(false);
    expect(isPdfProductionAvailable(LIVE_TENANT)).toBe(false);
  });

  it('5 — Pilot-Mandant: Kennzeichnung, Risiko-Hinweis und Feedback vorbereitet', () => {
    stubLiveProductionEnv();
    vi.stubEnv('EXPO_PUBLIC_ENVIRONMENT_MODE', 'pilot');

    const settings = getTenantEnvironmentSettings(PILOT_TENANT);
    expect(settings?.isPilotTenant).toBe(true);
    expect(settings?.showKnownRisks).toBe(true);
    expect(settings?.feedbackModulePrepared).toBe(true);
    expect(getMode(PILOT_TENANT)).toBe('pilot');
    expect(shouldShowPilotBanner(PILOT_TENANT)).toBe(true);
    expect(getEnvironmentBannerLabel(PILOT_TENANT)).toContain('Pilotbetrieb');
  });

  it('6 — Audit: Blockierungen und Modusauflösung werden protokolliert', () => {
    stubLiveProductionEnv();

    assertDemoDataNotInProduction(DEMO_TENANT_ID);
    assertMockProviderAllowed(true, 'production', LIVE_TENANT);
    assertTenantAllowedForMode(LIVE_TENANT);

    const audit = getEnvironmentAuditTrail();
    expect(audit.some((event) => event.eventType === 'demo_data_blocked')).toBe(true);
    expect(audit.some((event) => event.eventType === 'mock_provider_blocked')).toBe(true);
    expect(audit.some((event) => event.eventType === 'mode_resolved')).toBe(true);
  });
});
