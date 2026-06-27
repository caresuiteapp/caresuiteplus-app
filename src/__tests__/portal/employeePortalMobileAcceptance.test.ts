import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('employee portal mobile acceptance fixes', () => {
  it('PortalTabScreen avoids nested scroll on phone inside portal shell', () => {
    const screen = readSrc('src/screens/portal/PortalTabScreen.tsx');
    expect(screen).toContain('const shellScroll = isPhone ? false : scroll');
    expect(screen).toContain('PortalMobileTabHeader');
    expect(screen).not.toMatch(/bareContent:[\s\S]*flex:\s*1/);
  });

  it('ScreenShell disables inner scroll on phone when aurora shell hosts background', () => {
    const shell = readSrc('src/components/layout/ScreenShell.tsx');
    expect(shell).toContain('const shellScroll = scroll && !(shellHostsAurora && isPhone)');
  });

  it('employee dashboard KPI tiles use responsive flex basis and noBreak labels', () => {
    const dashboard = readSrc('src/screens/portal/EmployeePortalDashboardScreen.tsx');
    expect(dashboard).toContain('flexBasis');
    expect(dashboard).toContain('minWidth: 152');
    expect(dashboard).toContain('noBreakTextProps');
    expect(dashboard).toContain('usePortalProfileAvatar');
  });

  it('schedule route centers content with mobile tab header', () => {
    const route = readSrc('app/portal/employee/(tabs)/schedule.tsx');
    expect(route).toContain('hideHeaderOnPhone');
    expect(route).toContain('alignSelf: \'center\'');
    expect(route).toContain('subtitle="Ihr Wochenplan"');
  });

  it('employee messages use portal tab screen without nested ScreenShell scroll', () => {
    const screen = readSrc('src/screens/portal/portalofficemessagesscreens.tsx');
    expect(screen).toContain('PortalTabScreen');
    expect(screen).toContain('hideHeaderOnPhone');
    expect(screen).toContain('PortalOfficeMessenger audience="employee"');
    expect(screen).toMatch(
      /return \(\s*<PortalTabScreen[\s\S]*PortalOfficeMessenger audience="employee"/,
    );
  });

  it('portal profile avatar resolves employee avatar_url before user profile', () => {
    const hook = readSrc('src/hooks/usePortalProfileAvatar.ts');
    expect(hook).toContain('fetchEmployeePortalAvatar');
    expect(hook).toContain('employeeUrl ?? userAvatar');
    const fetcher = readSrc('src/lib/portal/employeePortalAvatar.ts');
    expect(fetcher).toContain('avatar_url');
    expect(fetcher).toContain('mapEmployeeAvatarUrl');
  });

  it('profile avatar URL resolver supports employee-avatars bucket', () => {
    const resolver = readSrc('src/lib/auth/profileAvatarUrl.ts');
    expect(resolver).toContain('EMPLOYEE_AVATAR_BUCKET');
    expect(resolver).toContain('resolveAvatarBucket');
  });

  it('compact PortalTopBar uses small avatar without chevron menu trigger', () => {
    const topbar = readSrc('src/components/layout/portal/PortalTopBar.tsx');
    expect(topbar).toContain('usePortalProfileAvatar');
    expect(topbar).toContain('size="sm"');
    expect(topbar).not.toContain('compactProfileMenuTrigger');
  });

  it('PortalShell slot keeps minHeight 0 for shell scroll chain', () => {
    const portalShell = readSrc('src/components/portal/PortalShell.tsx');
    expect(portalShell).toContain('minHeight: 0');
  });

  it('AutoScrollView enables touch scrolling on web', () => {
    const scroll = readSrc('src/components/layout/AutoScrollView.tsx');
    expect(scroll).toContain('WebkitOverflowScrolling');
    expect(scroll).toContain('touchAction');
  });

  it('ScreenHeader balances side insets for centered titles', () => {
    const header = readSrc('src/components/layout/ScreenHeader.tsx');
    expect(header).toContain('sideInsetWidth');
    expect(header).toContain('width: sideInsetWidth');
  });
});
