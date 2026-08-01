import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { liquidPortalLoginRoutes } from '@/liquid-command/navigation/portalCatalog';

function collectRouteFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const candidate = join(directory, entry);
    return statSync(candidate).isDirectory() ? collectRouteFiles(candidate) : [candidate];
  });
}

function publicRoute(file: string): string {
  return `/${relative(resolve(process.cwd(), 'app'), file)}`
    .replaceAll('\\', '/')
    .replace(/\/(\([^/]+\))/g, '')
    .replace(/\/index\.tsx$/, '')
    .replace(/\.tsx$/, '')
    .replace(/\[[^\]]+\]/g, '[]');
}

describe('Portal navigation ownership', () => {
  it('has exactly one physical owner for every public portal URL', () => {
    const files = collectRouteFiles(resolve(process.cwd(), 'app/portal'))
      .filter((file) => file.endsWith('.tsx') && basename(file) !== '_layout.tsx');
    const owners = new Map<string, string[]>();

    for (const file of files) {
      const route = publicRoute(file);
      owners.set(route, [...(owners.get(route) ?? []), file]);
    }

    const collisions = [...owners.entries()]
      .filter(([, routeFiles]) => routeFiles.length > 1)
      .map(([route, routeFiles]) => ({ route, routeFiles }));

    expect(collisions).toEqual([]);
  });

  it('keeps logout visible in desktop and mobile portal navigation', () => {
    const routeShell = readFileSync(
      resolve(process.cwd(), 'src/liquid-command/shell/LiquidPortalRouteLayout.tsx'),
      'utf8',
    );
    const portalHome = readFileSync(
      resolve(process.cwd(), 'src/liquid-command/screens/PortalHomeScreen.tsx'),
      'utf8',
    );

    expect(routeShell).toContain('accessibilityLabel="Sicher abmelden"');
    expect(routeShell).toContain('<Text style={styles.moreLabel}>Abmelden</Text>');
    expect(portalHome).toContain('accessibilityLabel="Sicher abmelden"');
    expect(liquidPortalLoginRoutes).toEqual({
      employee: '/auth/employee-login',
      client: '/auth/client-login',
      relative: '/auth/client-login',
    });
  });
});
