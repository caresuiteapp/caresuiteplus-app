import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { isRouteAvailableInPortalApp } from '@/lib/platform/portalAppEdition';

const root = process.cwd();
const portalRoot = join(root, 'app-portal');

function listFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(absolute) : [absolute];
  });
}

describe('R14-A portal-only native edition', () => {
  it.each([
    '/',
    '/auth',
    '/auth/employee-login',
    '/auth/employee-first-login?accountId=123',
    '/auth/client-login',
    '/portal/employee',
    '/portal/employee/assignments/123/execute',
    '/portal/client',
    '/portal/client/documents/123',
  ])('allows the portal route %s', (route) => {
    expect(isRouteAvailableInPortalApp(route)).toBe(true);
  });

  it.each([
    '/auth/business-login',
    '/auth/register',
    '/auth/register-business',
    '/business',
    '/office',
    '/assist',
    '/settings',
    '/admin',
    '/platform',
    '/portal/family',
  ])('blocks the excluded route %s', (route) => {
    expect(isRouteAvailableInPortalApp(route)).toBe(false);
  });

  it('contains only portal and explicitly approved auth routes', () => {
    const routeFiles = listFiles(portalRoot)
      .filter((file) => /\.[jt]sx?$/.test(file))
      .map((file) => relative(portalRoot, file).replaceAll('\\', '/'));

    expect(routeFiles.some((file) => file.startsWith('business/'))).toBe(false);
    expect(routeFiles.some((file) => file.startsWith('office/'))).toBe(false);
    expect(routeFiles.some((file) => file.startsWith('assist/'))).toBe(false);
    expect(routeFiles.some((file) => file.startsWith('settings/'))).toBe(false);
    expect(routeFiles).not.toContain('auth/business-login.tsx');
    expect(routeFiles).not.toContain('auth/register.tsx');
    expect(routeFiles).not.toContain('auth/register-business.tsx');
  });

  it('keeps administration and registration out of the portal start module', () => {
    const source = readFileSync(
      join(root, 'src/portal-app/PortalAccessHubScreen.tsx'),
      'utf8',
    );

    expect(source).toContain("id: 'employee'");
    expect(source).toContain("id: 'client'");
    expect(source).not.toMatch(/administration|verwaltung|business-login|register/i);
    expect(source).not.toContain('access-administration.png');
  });

  it('keeps the complete administration entry on the desktop web start module', () => {
    const source = readFileSync(
      join(root, 'src/liquid-command/screens/AccessHubScreen.tsx'),
      'utf8',
    );

    expect(source).toContain("id: 'administration'");
    expect(source).toContain("route: '/auth/business-login'");
    expect(source).toContain('access-administration.png');
    expect(source).toContain('showRegistration');
  });

  it('maps every portal wrapper only to the existing portal route tree', () => {
    const wrappers = listFiles(join(portalRoot, 'portal')).filter((file) => file.endsWith('.tsx'));
    expect(wrappers.length).toBeGreaterThan(40);
    for (const wrapper of wrappers) {
      const source = readFileSync(wrapper, 'utf8');
      expect(source).toMatch(/from ['"](?:\.\.\/)+app\/portal\//);
      expect(source).not.toMatch(/app\/(business|office|assist|settings)\//);
    }
  });

  it('selects the isolated router root in both canonical EAS profiles', () => {
    const eas = JSON.parse(readFileSync(join(root, 'eas.json'), 'utf8'));
    expect(eas.build['portal-only-apk'].env.EXPO_PUBLIC_APP_EDITION).toBe('portal-only');
    expect(eas.build['portal-only-aab'].env.EXPO_PUBLIC_APP_EDITION).toBe('portal-only');
    expect(eas.build['portal-only-apk'].env.EXPO_PUBLIC_FOLDER).toBe('public-portal');
    expect(eas.build['portal-only-aab'].env.EXPO_PUBLIC_FOLDER).toBe('public-portal');
    expect(readFileSync(join(root, 'app.config.ts'), 'utf8')).toContain(
      "root: isPortalOnlyEdition ? 'app-portal' : 'app'",
    );
  });

  it('ships a repeatable bundle audit for the portal-only edition', () => {
    const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    const audit = readFileSync(join(root, 'scripts/audit-portal-only-export.mjs'), 'utf8');

    expect(packageJson.scripts['portal-only:export']).toContain('EXPO_PUBLIC_APP_EDITION=portal-only');
    expect(packageJson.scripts['portal-only:export']).toContain('EXPO_PUBLIC_FOLDER=public-portal');
    expect(packageJson.scripts['portal-only:export:audit']).toContain('audit-portal-only-export.mjs');
    expect(audit).toContain('forbiddenSourcePatterns');
    expect(audit).toContain('excludedAdministrationSources');
  });
});
