import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  PORTAL_MOBILE_INLINE_MAX,
  PORTAL_MOBILE_PRIMARY_MAX,
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
  { key: 'assist-nachweise', label: 'Nachweise', icon: '📋', href: '/portal/client?module=assist&section=nachweise' },
  { key: 'documents', label: 'Dokumente', icon: '📄', href: '/portal/client/documents' },
  { key: 'messages', label: 'Nachrichten', icon: '💬', href: '/portal/client/messages' },
  { key: 'profile', label: 'Profil', icon: '👤', href: '/portal/client/profile' },
];

describe('splitPortalTabsForMobile', () => {
  it('keeps all tabs inline when count is within threshold', () => {
    const small = sampleTabs.slice(0, PORTAL_MOBILE_INLINE_MAX);
    const split = splitPortalTabsForMobile(small, 'overview');
    expect(split.overflow).toHaveLength(0);
    expect(split.primary).toHaveLength(small.length);
  });

  it('splits into primary row and overflow when many tabs', () => {
    const split = splitPortalTabsForMobile(sampleTabs, 'assist-budget');
    expect(split.primary.length).toBe(PORTAL_MOBILE_PRIMARY_MAX);
    expect(split.overflow.length).toBeGreaterThan(0);
    expect(split.primary.some((tab) => tab.key === 'overview')).toBe(true);
    expect(split.primary.some((tab) => tab.key === 'assist-budget')).toBe(true);
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

  it('AssistPortalOverview uses safe bottom padding and single scroll surface', () => {
    const overview = readSrc('src/components/portal/assist/AssistPortalOverview.tsx');
    expect(overview).toContain('useSafeAreaInsets');
    expect(overview).toContain('showBottomTabs');
    expect(overview).toContain('PORTAL_MOBILE_NAV_HEIGHT');
    expect(overview).toContain("width: '100%'");
    expect(overview).toContain('resolvePortalHeroCopy');
    expect(overview).toContain('PortalOpenRequestsModal');
    expect(overview).toContain('PortalActivitiesModal');
    expect(overview).not.toContain('OFFENE ANFRAGEN');
    expect(overview).not.toContain('AKTIVITÄTEN');
  });

  it('overview route uses tabs layout shell instead of duplicate index', () => {
    const tabsRoute = readSrc('app/portal/client/(tabs)/index.tsx');
    expect(tabsRoute).toContain('AdaptivePortalOverview');
    const fs = require('node:fs');
    expect(fs.existsSync(path.join(root, 'app/portal/client/index.tsx'))).toBe(false);
  });

  it('PortalKpiCard uses adaptive column widths on phone', () => {
    const kpi = readSrc('src/components/portal/assist/PortalKpiCard.tsx');
    expect(kpi).toContain('kpiColumnsForDeviceClass');
    expect(kpi).toContain('breakpoints.largePhone');
    expect(kpi).toContain('minWidth: isPhone ? 0 : 150');
  });

  it('PortalQuickActions keeps touch-friendly chips on phone', () => {
    const actions = readSrc('src/components/portal/assist/PortalQuickActions.tsx');
    expect(actions).toContain('minHeight: 44');
    expect(actions).toContain('ScrollView');
    expect(actions).toContain('wrapGrid');
  });

  it('PortalNextAppointmentHero stacks actions on phone with 44px targets', () => {
    const hero = readSrc('src/components/portal/assist/PortalNextAppointmentHero.tsx');
    expect(hero).toContain('actionsPhone');
    expect(hero).toContain('minHeight: 44');
    expect(hero).toContain('Pressable');
  });

  it('portal mobile nav uses overflow menu instead of horizontal scroll', () => {
    const tabBar = readSrc('src/components/layout/AppTabBar.tsx');
    expect(tabBar).toContain('portalOverflowNav');
    expect(tabBar).toContain('PortalMobileNav');
    const mobileShell = readSrc('src/components/layout/MobileShell.tsx');
    expect(mobileShell).toContain("area === 'portal_client'");
    const nav = readSrc('src/components/layout/PortalMobileNav.tsx');
    expect(nav).toContain('PortalMoreMenu');
    expect(nav).toContain('Mehr');
  });

  it('PortalGlassHero places badge on eyebrow row on phone', () => {
    const hero = readSrc('src/components/portal/assist/PortalGlassHero.tsx');
    expect(hero).toContain('eyebrowRow');
    expect(hero).not.toContain('titleRowPhone');
  });

  it('PortalTabScreen hides duplicate header on phone overview', () => {
    const screen = readSrc('src/screens/portal/PortalTabScreen.tsx');
    expect(screen).toContain('hideHeaderOnPhone');
    const route = readSrc('app/portal/client/(tabs)/index.tsx');
    expect(route).toContain('hideHeaderOnPhone');
    expect(route).toContain('scroll={false}');
  });
});
