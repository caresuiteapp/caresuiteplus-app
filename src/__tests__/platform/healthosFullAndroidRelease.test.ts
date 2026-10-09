import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConfigContext } from 'expo/config';
import makeConfig from '../../../app.config';

const readJson = (file: string) => JSON.parse(readFileSync(join(process.cwd(), file), 'utf8'));
const resolveConfig = () => makeConfig({ config: readJson('app.json').expo } as ConfigContext);

function fullEnvironment() {
  vi.stubEnv('EXPO_PUBLIC_APP_EDITION', 'full');
  vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '');
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', '');
  vi.stubEnv('EAS_PROJECT_ID', '567bda34-8356-4de8-9349-a0de3143567e');
  vi.stubEnv('EAS_BUILD', 'false');
}

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

describe('HealthOS full native Android release', () => {
  it('resolves the full router with the existing public app identity', () => {
    fullEnvironment();
    const config = resolveConfig();
    expect(config.name).toBe('CareSuite HealthOS');
    expect(config.version).toBe('0.4.0');
    expect(config.android?.package).toBe('app.caresuitehealthos');
    expect(config.extra?.eas?.projectId).toBe('567bda34-8356-4de8-9349-a0de3143567e');
    expect(config.extra?.router?.root).toBe('app');
    expect(config.extra?.runtime?.appEdition).toBe('full');
    expect(config.plugins).toContainEqual(['expo-router', { root: 'app' }]);
  });

  it.each(['url', 'key', 'both'])('refuses a full EAS build with missing live %s', missing => {
    fullEnvironment();
    vi.stubEnv('EAS_BUILD', 'true');
    if (missing !== 'url' && missing !== 'both') vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://configured.supabase.co');
    if (missing !== 'key' && missing !== 'both') vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'fixture-key');
    expect(resolveConfig).toThrow(/HealthOS Full AAB abgebrochen/);
  });

  it.each(['EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'])('accepts a live full EAS build with %s', key => {
    fullEnvironment();
    vi.stubEnv('EAS_BUILD', 'true');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://configured.supabase.co');
    vi.stubEnv(key, 'fixture-key');
    expect(resolveConfig().extra?.runtime?.liveConfigured).toBe(true);
  });

  it('keeps the existing portal edition and default web branding separate', () => {
    fullEnvironment();
    vi.stubEnv('EXPO_PUBLIC_APP_EDITION', 'portal-only');
    expect(resolveConfig().extra?.router?.root).toBe('app-portal');
    expect(resolveConfig().extra?.runtime?.appEdition).toBe('portal-only');
    vi.stubEnv('EXPO_PUBLIC_APP_EDITION', '');
    expect(resolveConfig().name).toBe('CareSuite+');
  });

  it.each(['healthos-full-apk', 'healthos-full-aab'])('pins %s to the production full native configuration', profileName => {
    const eas = readJson('eas.json');
    const profile = eas.build[profileName];
    expect(eas.cli.appVersionSource).toBe('remote');
    expect(eas.build.production.node).toBe('20.19.4');
    expect(profile).toMatchObject({
      extends: 'production', environment: 'production', autoIncrement: true,
      env: { APP_ENV: 'production', EXPO_PUBLIC_DEMO_MODE: 'false', EXPO_PUBLIC_APP_EDITION: 'full', EXPO_PUBLIC_FOLDER: 'public-portal' },
    });
    expect(profile.android.buildType).toBe(profileName.endsWith('-aab') ? 'app-bundle' : 'apk');
    expect(profile.android.credentialsSource).toBe('remote');
    expect(eas.build['portal-only-aab'].env.EXPO_PUBLIC_APP_EDITION).toBe('portal-only');
    expect(eas.build['portal-only-apk'].env.EXPO_PUBLIC_APP_EDITION).toBe('portal-only');
  });

  it('does not apply the reduced core or portal route edition to all three native portals', async () => {
    fullEnvironment();
    const core = await import('@/lib/platform/healthOSStoreEdition');
    const portal = await import('@/lib/platform/portalAppEdition');
    expect(core.isHealthOSCoreEdition).toBe(false);
    expect(portal.isPortalOnlyEdition).toBe(false);
    for (const route of ['/auth/business-login', '/auth/register', '/auth/register-business', '/business', '/office', '/portal/employee', '/portal/client']) {
      expect(core.isRouteAvailableInHealthOSCore(route)).toBe(true);
    }
  });
});
