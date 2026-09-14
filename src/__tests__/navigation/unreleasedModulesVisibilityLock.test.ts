import { describe, expect, it } from 'vitest';
import { buildDesktopApps } from '@/liquid-command/navigation/desktopAppCatalog.web';
import { checkProductAccess } from '@/lib/navigation/redirects';
import { readFileSync } from 'node:fs';

const LOCKED_ROOTS = ['/pflege', '/stationaer', '/beratung', '/akademie'] as const;

describe('globale Sichtbarkeits- und Routensperre unveroeffentlichter Module', () => {
  it('entfernt alle gesperrten Module und Unterseiten aus Navigation und Apps', () => {
    const apps = buildDesktopApps([], 'business_admin');

    for (const app of apps) {
      expect(LOCKED_ROOTS.some((root) => app.route === root || app.route.startsWith(`${root}/`))).toBe(false);
    }
  });

  it.each(LOCKED_ROOTS)('blockiert Admin-Direktzugriff auf %s', (route) => {
    const decision = checkProductAccess(route, 'business_admin', 'tenant-live');

    expect(decision.shouldRedirect).toBe(true);
    expect(decision.reason).toBe('module_disabled');
    expect(decision.target).toBe('/');
  });

  it('entfernt die Produkte auch aus Dock und Befehlspalette', () => {
    const shell = readFileSync('src/liquid-command/shell/LiquidCommandShell.tsx', 'utf8');

    expect(shell).toContain('!isUnreleasedModuleKey(module.key)');
    expect(shell).toContain('!isUnreleasedModuleRoute(shortcut.route)');
  });
});
