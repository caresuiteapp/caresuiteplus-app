import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { APP_ROUTES } from '@/lib/navigation/routes';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

const ACCESS_ROUTE_PATHS = [
  '/business/office/access',
  '/business/office/access/internal-users',
  '/business/office/access/employee-portal',
  '/business/office/access/client-portal',
  '/business/office/access/relative-portal',
  '/business/office/access/roles',
  '/business/office/access/login-audit',
  '/business/office/access/module-permissions',
];

const ADMIN_ROUTE_PATHS = [
  '/business/admin/developer',
  '/business/admin/design-system',
  '/business/admin/architecture',
];

describe('Access Management Heroes (Sprint 107)', () => {
  it('AccessManagementDashboardHero nutzt PremiumListHeroFrame', () => {
    const hero = readSrc('src/components/access/AccessManagementDashboardHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('isAccessManagementLiveReady');
  });

  it('AccessListHero deckt alle Zugangs-Listen-Varianten ab', () => {
    const stats = readSrc('src/lib/access/accessListStats.ts');
    expect(stats).toContain("'internal-users'");
    expect(stats).toContain("'employee-portal'");
    expect(stats).toContain("'login-audit'");
    expect(stats).toContain("'module-permissions'");
    expect(readSrc('src/components/access/AccessListHero.tsx')).toContain('AccessListHeroVariant');
  });

  it('AccessManagementDashboardScreen nutzt Dashboard-Hero statt flacher KPI-Cards', () => {
    const screen = readSrc('src/screens/office/access/AccessManagementDashboardScreen.tsx');
    expect(screen).toContain('AccessManagementDashboardHero');
    expect(screen).not.toContain('PremiumCard key={label');
  });

  it('InternalUsersScreen nutzt AccessListHero und LoadingState', () => {
    const screen = readSrc('src/screens/office/access/InternalUsersScreen.tsx');
    expect(screen).toContain('AccessListHero');
    expect(screen).toContain('LoadingState');
    expect(screen).toContain('ErrorState');
    expect(screen).toContain('useDemoData');
  });

  it('LoginAuditScreen nutzt AccessListHero und EmptyState', () => {
    const screen = readSrc('src/screens/office/access/LoginAuditScreen.tsx');
    expect(screen).toContain('AccessListHero');
    expect(screen).toContain('variant="login-audit"');
    expect(screen).toContain('EmptyState');
  });
});

describe('Auth/Admin/TI Settings Heroes (Sprint 107)', () => {
  it('AuthRegisterHero nutzt PremiumListHeroFrame', () => {
    const hero = readSrc('src/components/auth/AuthRegisterHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('REGISTRIERUNG');
    expect(hero).toContain('Unternehmen anlegen');
  });

  it('OnboardingSetupHero nutzt PremiumListHeroFrame', () => {
    const hero = readSrc('src/components/auth/OnboardingSetupHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('Demo-Prototyp');
  });

  it('BusinessRegisterScreen nutzt AuthRegisterHero statt flachem PremiumCard-Header', () => {
    const screen = readSrc('src/screens/auth/BusinessRegisterScreen.tsx');
    expect(screen).toContain('AuthRegisterHero');
    expect(screen).not.toContain('<PremiumCard accentColor={colors.orange}>');
  });

  it('CompanySetupScreen nutzt OnboardingSetupHero statt PremiumBadge-Header', () => {
    const screen = readSrc('src/screens/onboarding/CompanySetupScreen.tsx');
    expect(screen).toContain('OnboardingSetupHero');
    expect(screen).not.toContain('PremiumBadge label="Schritt 2');
  });

  it('DeveloperHubScreen nutzt DeveloperHubHero', () => {
    const screen = readSrc('src/screens/admin/DeveloperHubScreen.tsx');
    expect(screen).toContain('DeveloperHubHero');
    expect(readSrc('src/components/admin/DeveloperHubHero.tsx')).toContain('__DEV__');
  });

  it('TIProviderSettingsScreen nutzt TIProviderSettingsHero', () => {
    const screen = readSrc('src/screens/ti/TIProviderSettingsScreen.tsx');
    expect(screen).toContain('TIProviderSettingsHero');
  });
});

describe('APP_ROUTES Access & Admin gaps (Sprint 107)', () => {
  it('APP_ROUTES enthält Office-Access-Pfade', () => {
    for (const routePath of ACCESS_ROUTE_PATHS) {
      expect(APP_ROUTES.some((r) => r.path === routePath)).toBe(true);
    }
  });

  it('APP_ROUTES enthält Admin-Dev-Pfade', () => {
    for (const routePath of ADMIN_ROUTE_PATHS) {
      expect(APP_ROUTES.some((r) => r.path === routePath)).toBe(true);
    }
  });

  it('App-Routen für Access-Management existieren', () => {
    expect(fs.existsSync(path.join(process.cwd(), 'app/business/office/access/index.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), 'app/business/admin/developer/index.tsx'))).toBe(true);
  });
});
