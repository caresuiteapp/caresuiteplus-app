import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('employee first-login mobile fixes', () => {
  it('ScreenShell keeps scroll on phone for auth routes outside portal shell', () => {
    const shell = readSrc('src/components/layout/ScreenShell.tsx');
    expect(shell).toContain('isPortalRoutePath(pathname)');
    expect(shell).toContain('isAuthRoutePath(pathname)');
    expect(shell).toContain('const disableMobileInnerScroll = shellHostsAurora && isPhone && isPortalShell');
    expect(shell).toContain('!(isPhone && isAuthRoute)');
    expect(shell).toContain('useMobileTouchScroll');
    expect(shell).toContain('AutoScrollView');
    expect(shell).toContain('MOBILE_AUTH_BOTTOM_RESERVE');
  });

  it('EmployeeFirstLoginHero hides step KPI row on phone to keep form above fold', () => {
    const hero = readSrc('src/components/auth/EmployeeFirstLoginHero.tsx');
    expect(hero).toContain('useDeviceClass');
    expect(hero).toContain('!isPhone');
    expect(hero).toContain('value="Einmalpasswort"');
    expect(hero).toContain('value="Neues Passwort"');
    expect(hero).toContain('value="DSGVO"');
    expect(hero).toContain('valueLines={2}');
  });

  it('EmployeeFirstLoginPasswordScreen uses auth InputField and requires DSGVO before submit', () => {
    const screen = readSrc('src/screens/auth/EmployeeFirstLoginPasswordScreen.tsx');
    expect(screen).toContain("from '@/design/components'");
    expect(screen).toContain('<InputField');
    expect(screen).not.toContain('<PremiumInput');
    expect(screen).toContain('acceptedTerms');
    expect(screen).toContain('disabled={!acceptedTerms || loading}');
    expect(screen).toContain('completeFirstLogin');
  });

  it('isAuthRoutePath matches employee first-login', () => {
    const routes = readSrc('src/lib/navigation/isPortalRoute.ts');
    expect(routes).toContain('isAuthRoutePath');
    expect(routes).toContain("path.startsWith('/auth/')");
  });
});
