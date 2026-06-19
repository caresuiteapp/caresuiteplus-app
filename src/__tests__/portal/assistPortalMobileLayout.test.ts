import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  PORTAL_MOBILE_TAB_KEYS,
  resolveFixedMobilePortalTabs,
  splitPortalTabsForMobile,
} from '@/lib/navigation/portalMobileTabs';
import { resolvePortalHeroCopy, resolveTimeBasedGermanGreeting } from '@/lib/portal/engine/portalHeroCopy';
import type { ShellTabConfig } from '@/types/navigation/shell';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

const sampleTabs: ShellTabConfig[] = [
  { key: 'overview', label: 'Übersicht', icon: '🏠', href: '/portal/client' },
  { key: 'assist-appointments', label: 'Termine', icon: '📅', href: '/portal/client/appointments' },
  { key: 'assist-betreuung', label: 'Betreuung', icon: '🤝', href: '/portal/client?module=assist&section=betreuung' },
  { key: 'assist-budget', label: 'Budget', icon: '💶', href: '/portal/client?module=assist&section=budget' },
  { key: 'assist-anfragen', label: 'Anfragen', icon: '📨', href: '/portal/client?modal=anfragen' },
  { key: 'documents', label: 'Dokumente', icon: '📄', href: '/portal/client/documents' },
  { key: 'messages', label: 'Nachrichten', icon: '💬', href: '/portal/client/messages' },
  { key: 'profile', label: 'Profil', icon: '👤', href: '/portal/client/profile' },
];

describe('resolveFixedMobilePortalTabs', () => {
  it('returns exactly five fixed tabs in spec order', () => {
    const tabs = resolveFixedMobilePortalTabs(sampleTabs);
    expect(tabs).toHaveLength(5);
    expect(tabs.map((tab) => tab.key)).toEqual([...PORTAL_MOBILE_TAB_KEYS]);
    expect(tabs.map((tab) => tab.label)).toEqual([
      'Übersicht',
      'Termine',
      'Dokumente',
      'Nachrichten',
      'Profil',
    ]);
  });

  it('excludes Betreuung, Begleitungen, and overflow-only tabs', () => {
    const tabs = resolveFixedMobilePortalTabs(sampleTabs);
    expect(tabs.some((tab) => tab.key === 'assist-betreuung')).toBe(false);
    expect(tabs.some((tab) => tab.key === 'assist-budget')).toBe(false);
    expect(tabs.some((tab) => tab.key === 'assist-anfragen')).toBe(false);
  });
});

describe('splitPortalTabsForMobile', () => {
  it('always returns five primary tabs and no overflow', () => {
    const split = splitPortalTabsForMobile(sampleTabs, 'assist-budget');
    expect(split.primary).toHaveLength(5);
    expect(split.overflow).toHaveLength(0);
    expect(split.primary.map((tab) => tab.key)).toEqual([...PORTAL_MOBILE_TAB_KEYS]);
  });
});

describe('resolvePortalHeroCopy', () => {
  it('uses short time-based greeting on phone', () => {
    const copy = resolvePortalHeroCopy({
      displayName: 'Frau Ellen Zacharias',
      tenantName: 'Helferhasen+ UG',
      terminology: {
        greetingLabel: 'Willkommen in Ihrem Assist-Portal',
        moduleLabel: 'Assist',
        appointmentLabel: 'Termin',
        appointmentLabelPlural: 'Termine',
        personLabel: 'Klient:in',
        careTeamLabel: 'Assist-Team',
      },
      isPhone: true,
    });

    expect(copy.title).toContain('Frau Ellen Zacharias');
    expect(copy.title).not.toContain('Willkommen in Ihrem Assist-Portal');
    expect(copy.title.startsWith(resolveTimeBasedGermanGreeting())).toBe(true);
    expect(copy.meta).toContain('Helferhasen+ UG');
    expect(copy.subtitle).toBeUndefined();
  });

  it('keeps full welcome on desktop', () => {
    const copy = resolvePortalHeroCopy({
      displayName: 'Frau Ellen Zacharias',
      tenantName: 'Helferhasen+ UG',
      terminology: {
        greetingLabel: 'Willkommen in Ihrem Assist-Portal',
        moduleLabel: 'Assist',
        appointmentLabel: 'Termin',
        appointmentLabelPlural: 'Termine',
        personLabel: 'Klient:in',
        careTeamLabel: 'Assist-Team',
      },
      isPhone: false,
    });

    expect(copy.title).toContain('Willkommen in Ihrem Assist-Portal');
    expect(copy.subtitle).toBe('Helferhasen+ UG');
  });
});

describe('Assist portal mobile layout', () => {
  it('client portal tabs layout uses PortalShellLayout', () => {
    const layout = readSrc('app/portal/client/(tabs)/_layout.tsx');
    expect(layout).toContain('PortalShellLayout');
    expect(layout).not.toContain("from '@/components/layout'");
    expect(layout).not.toContain('<ShellLayout');
  });

  it('delegates phone overview to MobilePortalDashboard without touching desktop JSX', () => {
    const overview = readSrc('src/components/portal/assist/AssistPortalOverview.tsx');
    expect(overview).toContain('MobilePortalDashboard');
    expect(overview).toContain('if (isPhone)');
    expect(overview).toContain('isPhone: false');
    expect(overview).toContain('PortalKpiCard');
  });

  it('MobilePortalDashboard uses safe bottom padding and single scroll surface', () => {
    const mobile = readSrc('src/components/portal/assist/MobilePortalDashboard.tsx');
    expect(mobile).toContain('useSafeAreaInsets');
    expect(mobile).toContain('PORTAL_MOBILE_NAV_HEIGHT');
    expect(mobile).toContain("width: '100%'");
    expect(mobile).toContain('MobilePortalKpiCard');
    expect(mobile).toContain('MobilePortalSidebarCards');
    expect(mobile).toContain('emptyActionLabel="Termin anfragen"');
  });

  it('overview route uses tabs layout shell instead of duplicate index', () => {
    const tabsRoute = readSrc('app/portal/client/(tabs)/index.tsx');
    expect(tabsRoute).toContain('AdaptivePortalOverview');
    const fs = require('node:fs');
    expect(fs.existsSync(path.join(root, 'app/portal/client/index.tsx'))).toBe(false);
  });

  it('MobilePortalKpiCard uses two-column neon tiles on phone', () => {
    const kpi = readSrc('src/components/portal/assist/MobilePortalKpiCard.tsx');
    expect(kpi).toContain("'48%'");
    expect(kpi).toContain('glow');
    expect(kpi).toContain('minHeight: 132');
  });

  it('PortalQuickActions keeps touch-friendly chips on phone', () => {
    const actions = readSrc('src/components/portal/assist/PortalQuickActions.tsx');
    expect(actions).toContain('minHeight: 44');
    expect(actions).toContain('ScrollView');
    expect(actions).toContain('wrapGrid');
  });

  it('PortalNextAppointmentHero supports mobile empty CTA override', () => {
    const hero = readSrc('src/components/portal/assist/PortalNextAppointmentHero.tsx');
    expect(hero).toContain('emptyActionLabel');
    expect(hero).toContain('actionsPhone');
    expect(hero).toContain('minHeight: 44');
  });

  it('portal mobile nav uses five fixed tabs without overflow menu', () => {
    const tabBar = readSrc('src/components/layout/AppTabBar.tsx');
    expect(tabBar).toContain('portalOverflowNav');
    expect(tabBar).toContain('PortalMobileNav');
    const nav = readSrc('src/components/layout/PortalMobileNav.tsx');
    expect(nav).toContain('resolveFixedMobilePortalTabs');
    expect(nav).not.toContain('PortalMoreMenu');
    expect(nav).not.toContain('Mehr');
  });

  it('compact PortalTopBar has text brand, bell, avatar, chevron — no robot tagline', () => {
    const topbar = readSrc('src/components/layout/portal/PortalTopBar.tsx');
    expect(topbar).toContain('CareSuite+');
    expect(topbar).toContain('compactProfileChip');
    expect(topbar).toContain('chevron');
    expect(topbar).not.toContain('CareSuiteWordmark');
    expect(topbar).not.toContain('Pflege & Betreuung');
  });

  it('PortalGlassHero supports leading assist icon on phone', () => {
    const hero = readSrc('src/components/portal/assist/PortalGlassHero.tsx');
    expect(hero).toContain('leadingIcon');
    expect(hero).toContain('phoneRow');
    expect(hero).not.toContain('titleRowPhone');
  });

  it('PortalTabScreen hides duplicate header on phone overview', () => {
    const screen = readSrc('src/screens/portal/PortalTabScreen.tsx');
    expect(screen).toContain('hideHeaderOnPhone');
    const route = readSrc('app/portal/client/(tabs)/index.tsx');
    expect(route).toContain('hideHeaderOnPhone');
    expect(route).toContain('scroll={false}');
  });

  it('desktop shell layout unchanged at >=1200px breakpoint', () => {
    const shell = readSrc('src/components/layout/portal/PortalShellLayout.tsx');
    expect(shell).toContain('showRightSidebar = width >= BREAKPOINT_MIN.desktop');
    expect(shell).toContain('showLeftNav = !isPhone');
    expect(shell).toContain('PortalLeftNav');
    expect(shell).not.toContain('MobilePortalDashboard');
    const sidebar = readSrc('src/components/layout/portal/PortalRightSidebar.tsx');
    expect(sidebar).toContain('width < 1200');
    expect(sidebar).toContain('usePortalSidebarData');
  });
});
