import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { isPortalRoutePath } from '@/lib/navigation/isPortalRoute';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('isPortalRoutePath', () => {
  it('matches portal route prefixes', () => {
    expect(isPortalRoutePath('/portal/client')).toBe(true);
    expect(isPortalRoutePath('/portal/employee/assignments/1')).toBe(true);
    expect(isPortalRoutePath('/portal/relative/messages')).toBe(true);
    expect(isPortalRoutePath('/portal')).toBe(true);
  });

  it('does not match office or auth routes', () => {
    expect(isPortalRoutePath('/business')).toBe(false);
    expect(isPortalRoutePath('/auth/client-login')).toBe(false);
    expect(isPortalRoutePath('/assist')).toBe(false);
  });
});

describe('Portal animated background wiring', () => {
  it('portal root layout mounts ShellAnimatedBackgroundLayer', () => {
    const layout = readSrc('app/portal/_layout.tsx');
    expect(layout).toContain('ShellAnimatedBackgroundLayer');
    expect(layout).toContain("backgroundColor: 'transparent'");
  });

  it('ShellAnimatedBackgroundLayer gates motion on mobile like app root', () => {
    const shell = readSrc('src/components/ui/effects/ShellAnimatedBackgroundLayer.tsx');
    expect(shell).toContain('shouldUseHeavyEffects');
    expect(shell).toContain('!perf.isMobile');
    expect(shell).toContain('useHydrated');
  });

  it('app root skips global background on portal routes', () => {
    const layout = readSrc('app/_layout.tsx');
    expect(layout).toContain('isPortalRoutePath');
    expect(layout).toContain('hostsGlobalBackground');
  });

  it('client and employee tab shells stay transparent', () => {
    const clientTabs = readSrc('app/portal/client/(tabs)/_layout.tsx');
    const employeeTabs = readSrc('app/portal/employee/(tabs)/_layout.tsx');
    const clientLayout = readSrc('app/portal/client/_layout.tsx');
    const employeeLayout = readSrc('app/portal/employee/_layout.tsx');
    expect(clientTabs).toContain("backgroundColor: 'transparent'");
    expect(employeeTabs).toContain("backgroundColor: 'transparent'");
    expect(clientLayout).toContain('ClientPortalShell');
    expect(employeeLayout).toContain('EmployeePortalShell');
  });

  it('relative portal uses RelativePortalShell', () => {
    const layout = readSrc('app/portal/relative/_layout.tsx');
    expect(layout).toContain('RelativePortalShell');
  });

  it('PortalShellLayout keeps transparent surfaces for glass cards', () => {
    const shell = readSrc('src/components/layout/portal/PortalShellLayout.tsx');
    expect(shell).toContain("backgroundColor: 'transparent'");
    expect(shell).toContain("'relative'");
    expect(shell).toContain('Angehörigenportal');
  });

  it('AutoScrollView scroll hosts are transparent', () => {
    const scroll = readSrc('src/components/layout/AutoScrollView.tsx');
    expect(scroll).toContain("backgroundColor: 'transparent'");
  });
});
