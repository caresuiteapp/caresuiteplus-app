import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Assist portal mobile layout', () => {
  it('AssistPortalShell delegates nav to ShellLayout tabs', () => {
    const shell = readSrc('src/components/portal/assist/AssistPortalShell.tsx');
    expect(shell).not.toContain('buildPortalNavigation');
    expect(shell).not.toContain('ScrollView');
    expect(shell).toContain('flex: 1');
  });

  it('AssistPortalOverview uses safe bottom padding and single scroll surface', () => {
    const overview = readSrc('src/components/portal/assist/AssistPortalOverview.tsx');
    expect(overview).toContain('useSafeAreaInsets');
    expect(overview).toContain('showBottomTabs');
    expect(overview).toContain("width: '100%'");
    expect(overview).toContain('paddingHorizontal: careSpacing.md');
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

  it('AppTabBar scrolls when many portal tabs on phone', () => {
    const tabBar = readSrc('src/components/layout/AppTabBar.tsx');
    expect(tabBar).toContain('SCROLLABLE_TAB_THRESHOLD');
    expect(tabBar).toContain('ScrollView');
    expect(tabBar).toContain('minHeight: 44');
  });

  it('client portal overview avoids nested scroll views', () => {
    const route = readSrc('app/portal/client/(tabs)/index.tsx');
    expect(route).toContain('scroll={false}');
  });
});
