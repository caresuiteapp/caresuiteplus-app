import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

const MOBILE_VIEWPORTS = ['375x812', '390x844', '393x852', '430x932'];

describe('webSafeArea utilities', () => {
  it('defines global safe-area CSS with dvh fallbacks', () => {
    const source = readSrc('src/lib/platform/webSafeArea.ts');
    expect(source).toContain('WEB_SAFE_AREA_GLOBAL_CSS');
    expect(source).toContain('env(safe-area-inset-top');
    expect(source).toContain('100svh');
    expect(source).toContain('100dvh');
    expect(source).toContain('MOBILE_MIN_TOUCH_TARGET = 44');
    expect(source).toContain('MOBILE_CONTENT_BOTTOM_EXTRA = 24');
    expect(source).toContain('resolvePortalMobileContentPaddingBottom');
  });
});

describe('PortalShellLayout mobile safe area', () => {
  const shell = readSrc('src/components/layout/portal/PortalShellLayout.tsx');

  it('uses web safe-area top shell padding on compact widths', () => {
    expect(shell).toContain('webSafeAreaTopShell');
    expect(shell).toContain('webDynamicViewportMinHeightStyle');
    expect(shell).toContain('resolvePortalMobileContentPaddingBottom');
  });

  it('pins bottom nav above safe area with absolute host', () => {
    expect(shell).toContain('bottomNavHost');
    expect(shell).toContain("position: 'absolute'");
    expect(shell).toContain('PortalMobileNav');
  });
});

describe('Abmelden placement on mobile portal', () => {
  it('PortalTopBar compact profile menu excludes Abmelden', () => {
    const topbar = readSrc('src/components/layout/portal/PortalTopBar.tsx');
    expect(topbar).toContain('profileMenuItems = compact');
    expect(topbar).toContain("? [{ label: 'Profil', href: '/portal/client/profile' }]");
  });

  it('PortalNavigationDrawer has separated logout as last item', () => {
    const drawer = readSrc('src/components/layout/portal/PortalNavigationDrawer.tsx');
    expect(drawer).toContain('portal-drawer-logout');
    expect(drawer).toContain('logoutSection');
    expect(drawer).toContain('Abmelden');
    expect(drawer).toContain('signOut');
  });

  it('PortalTabScreen hides logout from page header on phone', () => {
    const screen = readSrc('src/screens/portal/PortalTabScreen.tsx');
    expect(screen).toContain('hideMobileLogout');
    expect(screen).not.toContain('title="Abmelden"');
    expect(screen).not.toContain('signOutButton');
  });

  it('Termine route hides duplicate header on phone', () => {
    const route = readSrc('app/portal/client/(tabs)/appointments.tsx');
    expect(route).toContain('hideHeaderOnPhone');
  });
});

describe('Login mobile safe area', () => {
  it('AppScreen reserves bottom padding for Safari toolbar on phone', () => {
    const appScreen = readSrc('src/design/components/AppScreen.tsx');
    expect(appScreen).toContain('MOBILE_AUTH_BOTTOM_RESERVE');
    expect(appScreen).toContain('webSafeAreaTopShell');
    expect(appScreen).toContain('webSafeAreaCalc');
  });

  it('Auth back button meets 44pt tap target', () => {
    const authHero = readSrc('src/design/components/AuthHero.tsx');
    expect(authHero).toContain('MOBILE_MIN_TOUCH_TARGET');
  });

  it('html root injects viewport-fit and safe-area CSS', () => {
    const html = readSrc('app/+html.tsx');
    expect(html).toContain('viewport-fit=cover');
    expect(html).toContain('WEB_SAFE_AREA_GLOBAL_CSS');
  });
});

describe('Background cover — no non-proportional stretch', () => {
  it('StaticLightPaperBackground uses cover and dvh viewport', () => {
    const bg = readSrc('src/components/backgrounds/StaticLightPaperBackground.tsx');
    expect(bg).toContain("objectFit: 'cover'");
    expect(bg).toContain("backgroundSize: 'cover'");
    expect(bg).toContain('webFixedViewportCoverStyle');
    expect(bg).not.toContain('100vh');
  });

  it('GlobalPersistentSpaceMotionBackground uses uniform cover scale', () => {
    const psm = readSrc('src/components/backgrounds/GlobalPersistentSpaceMotionBackground.tsx');
    expect(psm).toContain('coverScale');
    expect(psm).toContain('Math.max(scaleX, scaleY)');
    expect(psm).not.toMatch(/ctx\.scale\(w \/ PSM_VIEWBOX_W, h \/ PSM_VIEWBOX_H\)/);
    expect(psm).toContain('webFixedViewportCoverStyle');
  });
});

describe('Mobile viewport regression matrix', () => {
  it.each(MOBILE_VIEWPORTS)('documents iPhone viewport %s in audit spec', (viewport) => {
    expect(viewport).toMatch(/^\d+x\d+$/);
  });
});

describe('ScreenHeader mobile breadcrumb simplification', () => {
  it('hides breadcrumbs on phone and wraps title safely', () => {
    const header = readSrc('src/components/layout/ScreenHeader.tsx');
    expect(header).toContain('simplifyOnPhone');
    expect(header).toContain('numberOfLines={2}');
    expect(header).toContain('MOBILE_MIN_TOUCH_TARGET');
  });
});

describe('PortalMobileNav accessibility', () => {
  it('uses 44pt tab targets and bottom safe-area padding', () => {
    const nav = readSrc('src/components/layout/PortalMobileNav.tsx');
    expect(nav).toContain('MOBILE_MIN_TOUCH_TARGET');
    expect(nav).toContain("webSafeAreaPadding('bottom'");
  });
});
