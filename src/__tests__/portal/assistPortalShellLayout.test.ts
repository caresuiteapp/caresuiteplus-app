import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('PortalShellLayout', () => {
  it('client tabs layout uses ClientPortalShell wrapper', () => {
    const layout = readSrc('app/portal/client/(tabs)/_layout.tsx');
    expect(layout).toContain('ClientPortalShell');
    expect(layout).not.toContain("from '@/components/layout'");
    expect(layout).not.toContain('<ShellLayout');
    expect(layout).not.toContain('area="portal_client"');
  });

  it('employee portal uses PortalShellLayout not PlatformShell', () => {
    const shell = readSrc('src/components/portal/PortalShell.tsx');
    expect(shell).toContain('PortalShellLayout');
    expect(shell).not.toContain("from '@/components/layout'");
    expect(shell).not.toContain('PlatformShell');
  });

  it('PortalShellLayout composes client-only nav components', () => {
    const shell = readSrc('src/components/layout/portal/PortalShellLayout.tsx');
    expect(shell).toContain('PortalLeftNav');
    expect(shell).toContain('PortalTopBar');
    expect(shell).toContain('PortalRightSidebar');
    expect(shell).toContain('PortalMobileNav');
    expect(shell).not.toContain('PlatformShell');
    expect(shell).not.toContain('MainModuleRail');
    expect(shell).not.toContain('ModuleNavSidebar');
    expect(shell).not.toContain('RightContextPanel');
  });

  it('PortalTopBar has client-facing search and no office tenant menu', () => {
    const topbar = readSrc('src/components/layout/portal/PortalTopBar.tsx');
    expect(topbar).toContain('Im Portal suchen');
    expect(topbar).toContain('Klient:innenportal');
    expect(topbar).not.toContain('Module & Lizenzen');
    expect(topbar).not.toContain('Benutzer & Zugänge');
    expect(topbar).not.toContain('Mandant wechseln');
  });

  it('PortalLeftNav builds from portal engine not office nav', () => {
    const nav = readSrc('src/components/layout/portal/PortalLeftNav.tsx');
    expect(nav).toContain('buildPortalNavigation');
    expect(nav).not.toContain('getModuleNavConfig');
    expect(nav).not.toContain('OFFICE_TABS');
    expect(nav).not.toContain('BUSINESS_TABS');
  });

  it('PortalRightSidebar excludes office admin actions', () => {
    const sidebar = readSrc('src/components/layout/portal/PortalRightSidebar.tsx');
    expect(sidebar).toContain('SCHNELLZUGRIFF');
    expect(sidebar).toContain('usePortalSidebarData');
    expect(sidebar).not.toContain('Klient:in anlegen');
    expect(sidebar).not.toContain('Rechnung erstellen');
    expect(sidebar).not.toContain('Modulstatus');
  });

  it('portal navigation registry prepares pflege stationaer beratung keys', () => {
    const registry = readSrc('src/lib/portal/engine/portalNavigationRegistry.ts');
    expect(registry).toContain("'pflege'");
    expect(registry).toContain("'stationaer'");
    expect(registry).toContain("'beratung'");
    expect(registry).toContain('implemented: true');
    expect(registry).toContain('implemented: false');
  });

  it('assist left nav omits Nachweise and Aktivitäten sidebar items', () => {
    const navBuilder = readSrc('src/lib/portal/engine/buildPortalNavigation.ts');
    const registry = readSrc('src/lib/portal/engine/portalNavigationRegistry.ts');
    const matrix = readSrc('src/lib/portal/engine/portalFeatureMatrix.ts');
    expect(navBuilder).toContain('isPortalFeatureShownInPrimaryNav');
    expect(registry).toContain('PORTAL_PRIMARY_NAV_HIDDEN_FEATURE_KEYS');
    expect(registry).toContain("'nachweise'");
    expect(registry).toContain("'aktivitaeten'");
    expect(matrix).toContain("featureKey: 'nachweise'");
    expect(matrix).toContain('showInPrimaryNav: false');
  });
});
