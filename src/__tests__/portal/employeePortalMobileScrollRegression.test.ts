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
    expect(appointments).toContain("testID={isEmployeePortal ? 'employee-assignments-scroll' : undefined}");
    expect(appointments).toContain('keyboardShouldPersistTaps="handled"');
    expect(appointments).toContain('nestedScrollEnabled');
    expect(appointments).toMatch(
      /scrollViewport:\s*\{[\s\S]*flex:\s*1[\s\S]*minHeight:\s*0[\s\S]*touchAction:\s*'pan-y'/,
    );
    expect(appointments).toContain('RefreshControl refreshing={refreshing} onRefresh={refresh}');
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
