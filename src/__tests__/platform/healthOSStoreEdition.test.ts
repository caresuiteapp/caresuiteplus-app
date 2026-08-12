import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadEdition(value?: string) {
  vi.resetModules();
  if (value) vi.stubEnv('EXPO_PUBLIC_APP_EDITION', value);
  else vi.unstubAllEnvs();
  return import('@/lib/platform/healthOSStoreEdition');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('CareSuite HealthOS Google Play edition', () => {
  it('keeps the complete product as the default edition', async () => {
    const edition = await loadEdition();
    expect(edition.isRouteAvailableInHealthOSCore('/pflege')).toBe(true);
  });

  it('exposes only Heute, Office, Assist and Mehr in the store module navigation', async () => {
    const edition = await loadEdition('healthos-core');
    const modules = [
      { key: 'home' },
      { key: 'office' },
      { key: 'assist' },
      { key: 'pflege' },
      { key: 'stationaer' },
      { key: 'beratung' },
      { key: 'akademie' },
      { key: 'robotics' },
      { key: 'settings' },
    ];

    expect(edition.getEditionModules(modules as never).map((module) => module.key)).toEqual([
      'home',
      'office',
      'assist',
      'settings',
    ]);
  });

  it.each([
    '/',
    '/auth/business-login',
    '/auth/employee-portal-login',
    '/auth/client-login',
    '/office',
    '/business/office/clients/123',
    '/business/messages',
    '/assist/einsaetze',
    '/settings/profile',
    '/portal/employee/schedule',
    '/portal/client/documents',
  ])('allows the requested route %s', async (route) => {
    const edition = await loadEdition('healthos-core');
    expect(edition.isRouteAvailableInHealthOSCore(route)).toBe(true);
  });

  it.each([
    '/pflege',
    '/pflege/bodymap',
    '/stationaer',
    '/beratung/faelle',
    '/akademie/kurse',
    '/robotics',
    '/platform/tenants',
    '/admin',
    '/medical',
    '/portal/family',
    '/business/platform',
    '/business/admin',
    '/business/modules',
  ])('blocks excluded route %s', async (route) => {
    const edition = await loadEdition('healthos-core');
    expect(edition.isRouteAvailableInHealthOSCore(route)).toBe(false);
  });
});
