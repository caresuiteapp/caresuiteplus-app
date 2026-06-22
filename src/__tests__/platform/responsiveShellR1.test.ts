import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Responsive Shell R.1 — mobile/tablet compact shell', () => {
  it('CareAdaptiveShell routes compact shell below 1024px desktop breakpoint', () => {
    const shell = readSrc('src/components/layout/CareAdaptiveShell.tsx');
    expect(shell).toContain('isDesktopOrWide');
    expect(shell).toContain('CompactPlatformShell');
    expect(shell).toContain('CareDesktopShell');
  });

  it('MobileAppShell exposes hamburger app bar and bottom nav', () => {
    const mobile = readSrc('src/components/layout/MobileAppShell.tsx');
    expect(mobile).toContain('ShellAppBar');
    expect(mobile).toContain('AppTabBar');
    expect(mobile).toContain('ShellNavigationDrawer');
    expect(mobile).toContain('testID="mobile-app-shell"');
  });

  it('ShellAppBar renders hamburger control', () => {
    const bar = readSrc('src/components/layout/ShellAppBar.tsx');
    expect(bar).toContain('☰');
    expect(bar).toContain('testID="shell-hamburger"');
    expect(bar).toContain('PlatformProfileMenu');
  });

  it('ShellNavigationDrawer uses overlay Modal not slide sidebar', () => {
    const drawer = readSrc('src/components/layout/ShellNavigationDrawer.tsx');
    expect(drawer).toContain('<Modal');
    expect(drawer).toContain('transparent');
    expect(drawer).toContain('testID="shell-navigation-drawer"');
    expect(drawer).not.toContain('position: \'absolute\'');
  });

  it('usePlatformLayout hides side navigation below desktop breakpoint', () => {
    const hook = readSrc('src/hooks/usePlatformLayout.ts');
    expect(hook).toContain('showSideNavigation: !isCompactShell');
    expect(hook).toContain('showBottomTabs: isCompactShell');
    expect(hook).toContain("adaptiveShell = isCompactShell ? 'compact' : 'desktop'");
  });

  it('PlatformShell desktop file unchanged for rail rendering at tablet+', () => {
    const platform = readSrc('src/components/layout/platform/platformshell.tsx');
    expect(platform).toContain('MainModuleRail');
    expect(platform).toContain('ModuleNavSidebar');
    expect(platform).not.toContain('MobileAppShell');
  });

  it('PortalShellLayout hides left nav and shows drawer on compact widths', () => {
    const portal = readSrc('src/components/layout/portal/PortalShellLayout.tsx');
    expect(portal).toContain('isDesktopOrWide');
    expect(portal).toContain('showLeftNav = isDesktopOrWide');
    expect(portal).toContain('PortalNavigationDrawer');
    expect(portal).toContain('showHamburger={isCompactShell}');
  });

  it('PortalTopBar compact mode includes hamburger', () => {
    const topbar = readSrc('src/components/layout/portal/PortalTopBar.tsx');
    expect(topbar).toContain('showHamburger');
    expect(topbar).toContain('portal-hamburger');
    expect(topbar).toContain('☰');
  });

  it('PortalLeftNav uses LLGAN liquid glass on light theme', () => {
    const nav = readSrc('src/components/layout/portal/PortalLeftNav.tsx');
    expect(nav).toContain('lightLiquidGlass.sidebar');
    expect(nav).toContain('lightLiquidGlassWebFx');
  });

  it('auth login glass uses stronger opacity for readability', () => {
    const glass = readSrc('src/design/tokens/lightLiquidGlassAuroraNebula.ts');
    expect(glass).toMatch(/view === 'login'\s*\?\s*Math\.min\(0\.90/);
    const auth = readSrc('src/design/tokens/authTypography.ts');
    expect(auth).toContain('useAuthFlowTypography');
  });

  it('shell preview hides technical strings on compact viewports', () => {
    const preview = readSrc('src/components/dev/PlatformShellPreviewContent.tsx');
    expect(preview).toContain('isDesktopOrWide');
    expect(preview).toContain('Responsive Shell-Vorschau');
  });

  it('shellLayoutMetrics defines compact shell breakpoint at 1023', () => {
    const metrics = readSrc('src/lib/platform/shellLayoutMetrics.ts');
    expect(metrics).toContain('COMPACT_SHELL_MAX_WIDTH');
    expect(metrics).toContain('isCompactShellWidth');
    expect(metrics).toContain('breakpoints.desktop - 1');
  });
});

describe('Responsive Shell R.1 — desktop protection', () => {
  it('DesktopShell has no bottom tab bar', () => {
    const desktop = readSrc('src/components/layout/DesktopShell.tsx');
    expect(desktop).not.toContain('AppTabBar');
    expect(desktop).not.toContain('MobileAppShell');
  });

  it('CareAdaptiveShell keeps CareDesktopShell for desktopOrWide', () => {
    const shell = readSrc('src/components/layout/CareAdaptiveShell.tsx');
    expect(shell).toMatch(/if \(isDesktopOrWide\)[\s\S]*CareDesktopShell/);
  });
});
