import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.join(__dirname, '..', '..', '..');
const read = (relativePath: string) => readFileSync(path.join(root, relativePath), 'utf8');

describe('employee portal mobile scroll regression', () => {
  it('keeps assignments scrollable although the route delegates scroll ownership', () => {
    const route = read('app/portal/employee/(tabs)/assignments.tsx');
    const appointments = read('src/components/portal/PortalAppointmentsTab.tsx');

    expect(route).toContain('scroll={false}');
    expect(appointments).toContain("testID={isEmployeePortal ? 'employee-assignments-scroll' : 'client-appointments-scroll'}");
    expect(appointments).toContain('keyboardShouldPersistTaps="handled"');
    expect(appointments).toContain('nestedScrollEnabled');
    expect(appointments).toMatch(
      /scrollViewport:\s*\{[\s\S]*flex:\s*1[\s\S]*minHeight:\s*0[\s\S]*touchAction:\s*'pan-y'/,
    );
    expect(appointments).toContain('RefreshControl refreshing={refreshing} onRefresh={refresh}');
  });

  it('gives client overview and appointment pages an explicit mobile scroll owner', () => {
    const portalScreen = read('src/screens/portal/PortalTabScreen.tsx');
    const clientHome = read('app/portal/client/(tabs)/index.tsx');
    const appointments = read('src/components/portal/PortalAppointmentsTab.tsx');

    expect(portalScreen).toContain('testID="client-portal-tab-scroll"');
    expect(portalScreen).toContain('styles.bareScrollViewport');
    expect(clientHome).toContain('scroll');
    expect(appointments).toContain("'client-appointments-scroll'");
    expect(appointments).not.toContain('if (!isEmployeePortal && isPhone)');
  });

  it('keeps mobile login forms inside keyboard and safe-area aware scrolling', () => {
    const access = read('src/liquid-command/screens/AccessScreens.tsx');

    expect(access).toContain('useSafeAreaInsets');
    expect(access).toContain('keyboardVerticalOffset');
    expect(access).toContain('style={styles.accessScrollViewport}');
    expect(access).toMatch(/accessScroll:\s*\{[\s\S]*flexGrow:\s*1/);
  });

  it('prevents start page cards from exceeding a phone viewport', () => {
    const home = read('src/liquid-command/screens/PortalHomeScreen.tsx');

    expect(home).toContain('layout.isPhone && styles.portalDashboardGridPhone');
    expect(home).toContain('layout.isPhone && styles.dashboardCardPhone');
    expect(home).toMatch(
      /dashboardCardPhone:\s*\{[\s\S]*minWidth:\s*0[\s\S]*width:\s*'100%'[\s\S]*maxWidth:\s*'100%'/,
    );
    expect(home).toMatch(
      /portalDashboardGridPhone:\s*\{[\s\S]*flexDirection:\s*'column'[\s\S]*minWidth:\s*0/,
    );
  });
});
