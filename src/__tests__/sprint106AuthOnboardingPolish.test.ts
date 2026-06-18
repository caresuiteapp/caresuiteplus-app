import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { APP_ROUTES } from '@/lib/navigation/routes';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

const AUTH_ROUTE_PATHS = [
  '/auth/forgot-password',
  '/auth/portal-code-login',
  '/auth/employee-first-login',
  '/auth/register-business',
  '/auth/demo',
  '/settings/data-request',
  '/settings/account-deletion',
];

describe('Auth & Onboarding Premium Polish (Sprint 106)', () => {
  it('AuthLoginHero nutzt PremiumListHeroFrame', () => {
    const hero = readSrc('src/components/auth/AuthLoginHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('preparedOnly Auth');
  });

  it('OnboardingWelcomeHero nutzt PremiumListHeroFrame', () => {
    const hero = readSrc('src/components/auth/OnboardingWelcomeHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('Demo-Prototyp');
  });

  it('BusinessLoginScreen nutzt AuthLoginHero statt flachem PremiumCard-Header', () => {
    const screen = readSrc('src/screens/auth/BusinessLoginScreen.tsx');
    expect(screen).toContain('AuthLoginHero');
    expect(screen).not.toContain('<PremiumCard accentColor={colors.orange}>');
  });

  it('EmployeePortalLoginScreen und PortalCodeLoginScreen nutzen AuthLoginHero', () => {
    expect(readSrc('src/screens/auth/EmployeePortalLoginScreen.tsx')).toContain('AuthLoginHero');
    expect(readSrc('src/screens/auth/PortalCodeLoginScreen.tsx')).toContain('AuthLoginHero');
    expect(readSrc('src/screens/auth/ForgotPasswordScreen.tsx')).toContain('AuthLoginHero');
  });

  it('OnboardingWelcomeScreen nutzt OnboardingWelcomeHero', () => {
    const screen = readSrc('src/screens/onboarding/OnboardingWelcomeScreen.tsx');
    expect(screen).toContain('OnboardingWelcomeHero');
    expect(screen).not.toContain('PremiumBadge label="Öffentliches Onboarding');
  });
});

describe('APP_ROUTES Auth & Settings gaps (Sprint 106)', () => {
  it('APP_ROUTES enthält Auth- und Settings-Pfade', () => {
    for (const routePath of AUTH_ROUTE_PATHS) {
      expect(APP_ROUTES.some((r) => r.path === routePath)).toBe(true);
    }
  });
});
