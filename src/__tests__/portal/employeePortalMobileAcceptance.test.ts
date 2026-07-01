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

  it('ScreenShell disables inner scroll on phone only inside portal shell', () => {
    const shell = readSrc('src/components/layout/ScreenShell.tsx');
    expect(shell).toContain('const disableMobileInnerScroll = shellHostsAurora && isPhone && isPortalShell');
    expect(shell).toContain('isAuthRoutePath(pathname)');
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

  it('PortalShell passes children directly without flex slot wrapper', () => {
    const portalShell = readSrc('src/components/portal/PortalShell.tsx');
    expect(portalShell).not.toContain('styles.slot');
    expect(portalShell).toContain('{children}');
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

  it('signature modal uses fullscreen mobile capture with orientation gate and dismiss scope', () => {
    const modal = readSrc('src/components/inputs/CareSignatureModal.tsx');
    const overlay = readSrc('src/components/ui/FullscreenOverlay.tsx');
    const canvas = readSrc('src/components/inputs/CareSignatureCanvas.tsx');
    const panel = readSrc('src/components/portal/EmployeePortalVisitSignaturePanel.tsx');
    const orientation = readSrc('src/lib/orientation/requestLandscapeLock.ts');
    const prompt = readSrc('src/components/layout/LandscapePrompt.tsx');
    expect(modal).toContain('FullscreenOverlay');
    expect(modal).toContain('isPhone || isTablet');
    expect(modal).toContain('fillAvailable={fullscreen}');
    expect(modal).toContain('OrientationGate');
    expect(modal).toContain('screenKey="signature"');
    expect(modal).toContain('dismissScope');
    expect(modal).not.toContain('Pressable style={StyleSheet.absoluteFill}');
    expect(modal).toContain('overscrollBehavior');
    expect(modal).not.toContain('lockWebLandscapeOrientation');
    expect(overlay).toContain('createPortal');
    expect(overlay).toContain('document.body');
    expect(overlay).toContain('100dvh');
    expect(overlay).toContain('presentationStyle="fullScreen"');
    expect(overlay).toContain('FULLSCREEN_OVERLAY_Z_INDEX');
    expect(prompt).toContain('Trotzdem fortfahren');
    expect(prompt).not.toContain('position: \'absolute\'');
    expect(orientation).toContain("lock('landscape')");
    expect(canvas).toContain('fillAvailable');
    expect(canvas).toContain('actionLayout');
    expect(canvas).toContain('useOrientation');
    expect(canvas).toContain('scaleCanvasPoints');
    expect(canvas).toContain('Löschen');
    expect(canvas).toContain('Abbrechen');
    expect(canvas).toContain('Unterschrift bestätigen');
    expect(panel).toContain('CareSignatureModal');
    expect(panel).toContain('visitId');
  });

  it('visit execution screen uses workflow persistence without global landscape gate', () => {
    const screen = readSrc('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');
    const gate = readSrc('src/components/layout/OrientationGate.tsx');
    const prompt = readSrc('src/components/layout/LandscapePrompt.tsx');
    expect(screen).not.toContain('OrientationGate');
    expect(screen).not.toContain('screenKey="visitExecution"');
    expect(screen).toContain('useWorkflowPersistence');
    expect(gate).toContain('LandscapePrompt');
    expect(gate).not.toContain('LandscapeRequiredOverlay');
    expect(prompt).not.toContain('lock-unavailable');
  });

  it('employee schedule uses roster orientation gate only', () => {
    const route = readSrc('app/portal/employee/(tabs)/schedule.tsx');
    expect(route).toContain('OrientationGate');
    expect(route).toContain('screenKey="roster"');
  });
});
