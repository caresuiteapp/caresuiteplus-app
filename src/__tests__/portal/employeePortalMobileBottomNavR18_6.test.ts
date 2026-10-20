import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.join(__dirname, '..', '..', '..');
const read = (relativePath: string) =>
  readFileSync(path.join(root, relativePath), 'utf8').replace(/\r\n/g, '\n');

describe('employee portal mobile bottom navigation R18.6', () => {
  it('does not shorten the compact content frame a second time', () => {
    const layout = read('src/liquid-command/shell/LiquidPortalRouteLayout.tsx');

    expect(layout).not.toContain('compactContentBottomReserve');
    expect(layout).not.toContain(
      '!desktopChrome && !visitExecutionFocus && { marginBottom:',
    );
    expect(layout).toContain('style={styles.bottomNav} testID="portal-bottom-navigation"');
    expect(layout).toContain('testID="portal-navigation-footer"');
  });

  it('keeps exactly one navigation-safe reserve in the page scroll content', () => {
    const screen = read('src/screens/portal/PortalTabScreen.tsx');
    const appointments = read('src/components/portal/PortalAppointmentsTab.tsx');

    expect(screen).toContain('PORTAL_MOBILE_NAV_HEIGHT + spacing.lg');
    expect(screen).toContain('paddingBottom: bareBottomPadding');
    expect(appointments).toContain("testID={isEmployeePortal ? 'employee-assignments-scroll' : 'client-appointments-scroll'}");
    expect(appointments).toMatch(
      /scrollViewport:\s*\{[\s\S]*flex:\s*1[\s\S]*minHeight:\s*0[\s\S]*touchAction:\s*'pan-y'/,
    );
  });
});
