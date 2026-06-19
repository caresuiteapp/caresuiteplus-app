import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { APP_START_ENTRIES } from '@/data/landing/appStartEntries';
import { isGpsTrackingLiveReady } from '@/lib/assist/gpsTrackingConfig';
import {
  checkRoleAccess,
  getLoginRedirectForPath,
  resolveSessionHomeRoute,
  shouldShowPortalChoice,
} from '@/lib/navigation';
import { getUiVisibilityForRole } from '@/lib/ui/uiVisibility';
import { resolveVoiceFlowVisibility } from '@/lib/ui/voiceFlowVisibility';
import type { RoleKey } from '@/types';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

const PUBLIC_FORBIDDEN = [
  'VoiceFlow',
  'VoiceFlowPanel',
  'preparedOnly',
  'RLS',
  'Supabase',
  'Prototyp',
  'Debug',
  'ModuleTile',
  'CareBot',
];

describe('Google Play readiness — AppStart & session (Prompt 111)', () => {
  it('shows portal choice only without active session', () => {
    expect(shouldShowPortalChoice(false)).toBe(true);
    expect(shouldShowPortalChoice(true)).toBe(false);
  });

  it('resolveSessionHomeRoute routes business roles to /business', () => {
    expect(resolveSessionHomeRoute('business_admin')).toBe('/business');
    expect(resolveSessionHomeRoute('business_manager')).toBe('/business');
  });

  it('resolveSessionHomeRoute routes employee roles to employee portal', () => {
    for (const role of ['employee_portal', 'caregiver', 'nurse'] as RoleKey[]) {
      expect(resolveSessionHomeRoute(role)).toBe('/portal/employee');
    }
  });

  it('resolveSessionHomeRoute routes client roles to client portal', () => {
    for (const role of ['client_portal', 'family_portal'] as RoleKey[]) {
      expect(resolveSessionHomeRoute(role)).toBe('/portal/client');
    }
  });

  it('resolveSessionHomeRoute prefers portal session login type', () => {
    expect(
      resolveSessionHomeRoute('business_admin', {
        sessionToken: 'tok',
        tenantId: 't1',
        loginType: 'employee_portal',
        roleKey: 'employee_portal',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        accountId: 'acc-1',
      }),
    ).toBe('/portal/employee');
  });

  it('AppStartScreen restores session and shows loading splash', () => {
    const start = readSrc('src/screens/AppStartScreen.tsx');
    expect(start).toContain('resolveSessionHomeRoute');
    expect(start).toContain('shouldShowPortalChoice');
    expect(start).toContain('LoadingState');
    expect(start).toContain('router.replace(homePath');
    expect(start).not.toContain('return null');
  });

  it('AppStartScreen handles Android back on public start without auth loop', () => {
    const start = readSrc('src/screens/AppStartScreen.tsx');
    expect(start).toContain('BackHandler');
    expect(start).toContain('hardwareBackPress');

    const requireAuth = readSrc('src/lib/auth/RequireAuth.tsx');
    expect(requireAuth).toContain('router.replace');
    expect(requireAuth).not.toContain('router.push(target');
  });

  it('root layout provides AuthProvider and splash background', () => {
    const layout = readSrc('app/_layout.tsx');
    expect(layout).toContain('AuthProvider');
    expect(layout).toContain('StatusBar');
    expect(layout).toContain('backgroundColor');
  });
});

describe('Google Play readiness — public area', () => {
  it('defines four portal cards only', () => {
    expect(APP_START_ENTRIES).toHaveLength(4);
    expect(APP_START_ENTRIES.some((e) => e.path.includes('demo'))).toBe(false);
  });

  it('AppStartScreen has no feature cards or internal terms', () => {
    const start = readSrc('src/screens/AppStartScreen.tsx');
    for (const needle of PUBLIC_FORBIDDEN) {
      expect(start).not.toContain(needle);
    }
    expect(start).toContain('PortalCard');
    expect(start).not.toMatch(/onPress=\{\(\)\s*=>\s*\{\s*\}\}/);
  });

  it('portal cards navigate via router.push', () => {
    const start = readSrc('src/screens/AppStartScreen.tsx');
    expect(start).toContain('router.push(entry.path');
    for (const entry of APP_START_ENTRIES) {
      expect(entry.path).toMatch(/^\/auth\//);
    }
  });

  it('NotFound screen offers dashboard, start, and back navigation', () => {
    const notFound = readSrc('app/+not-found.tsx');
    expect(notFound).toContain('Seite nicht gefunden');
    expect(notFound).toContain('ErrorState');
    expect(notFound).toContain('Zum Dashboard');
    expect(notFound).toContain('Zum Start');
    expect(notFound).not.toContain('PremiumCard');
  });
});

describe('Google Play readiness — auth flows', () => {
  it('business login defers navigation to RedirectIfAuthenticated', () => {
    const login = readSrc('src/screens/auth/BusinessLoginScreen.tsx');
    expect(login).toContain('setSuccess(true)');
    expect(login).not.toContain('resolvePostLoginRoute');
    expect(login).not.toContain("router.replace('/business'");
    expect(login).toContain('/auth/forgot-password');
  });

  it('employee and client login screens defer post-auth navigation to guard', () => {
    const employee = readSrc('src/screens/auth/EmployeePortalLoginScreen.tsx');
    const client = readSrc('src/screens/auth/PortalCodeLoginScreen.tsx');
    expect(employee).toContain('setSuccess(true)');
    expect(client).toContain('setSuccess(true)');
    expect(employee).not.toContain('resolvePostLoginRoute');
    expect(client).not.toContain('resolvePostLoginRoute');
  });

  it('register and forgot-password routes exist', () => {
    expect(readSrc('app/auth/register-business.tsx')).toContain('BusinessRegisterScreen');
    expect(readSrc('app/auth/forgot-password.tsx')).toContain('ForgotPasswordScreen');
  });

  it('getLoginRedirectForPath maps protected areas to correct login', () => {
    expect(getLoginRedirectForPath('/business/office')).toBe('/auth/business-login');
    expect(getLoginRedirectForPath('/portal/employee')).toBe('/auth/employee-login');
    expect(getLoginRedirectForPath('/portal/client')).toBe('/auth/client-login');
  });
});

describe('Google Play readiness — role isolation', () => {
  it('blocks client portal role from business paths', () => {
    const decision = checkRoleAccess('/business', 'client_portal', { tenantId: 't1' });
    expect(decision.shouldRedirect).toBe(true);
  });

  it('blocks employee role from client portal paths when workspace denies', () => {
    const decision = checkRoleAccess('/portal/client', 'caregiver', { tenantId: 't1' });
    expect(decision.shouldRedirect).toBe(true);
  });

  it('business layout wraps RequireAuth and RequireRole', () => {
    const layout = readSrc('app/business/_layout.tsx');
    expect(layout).toContain('RequireAuth');
    expect(layout).toContain('RequireRole');
  });

  it('portal layouts use area-specific login redirects', () => {
    expect(readSrc('app/portal/employee/_layout.tsx')).toContain('/auth/employee-login');
    expect(readSrc('app/portal/client/_layout.tsx')).toContain('/auth/client-login');
  });
});

describe('Google Play readiness — permissions & production mode', () => {
  it('declares only INTERNET in android permissions', () => {
    const appJson = JSON.parse(readSrc('app.json'));
    expect(appJson.expo.android?.permissions).toEqual(['INTERNET']);
  });

  it('declares INTERNET and RECORD_AUDIO in android permissions via app.config', () => {
    const appConfig = readSrc('app.config.ts');
    expect(appConfig).toContain("'INTERNET'");
    expect(appConfig).toContain("'RECORD_AUDIO'");
    expect(appConfig).toContain('NSMicrophoneUsageDescription');
    expect(appConfig).toContain('expo-av');
  });

  it('VoiceFlow hidden for public and client roles', () => {
    const publicVis = resolveVoiceFlowVisibility({
      isAuthenticated: false,
      roleKey: null,
      assignmentId: 'a-1',
      documentationAllowed: true,
    });
    expect(publicVis.showPanel).toBe(false);

    const clientVis = resolveVoiceFlowVisibility({
      isAuthenticated: true,
      roleKey: 'client_portal',
      assignmentId: 'a-1',
      documentationAllowed: true,
    });
    expect(clientVis.showPanel).toBe(false);
  });

  it('production public users see no debug badges', () => {
    const visibility = getUiVisibilityForRole('public_user', 'production');
    expect(visibility.showDebugBadges).toBe(false);
    expect(visibility.showDemoModeBanner).toBe(false);
    expect(visibility.showDeveloperDiagnostics).toBe(false);
  });

  it('footer hides demo link in production environment', () => {
    const footer = readSrc('src/design/components/FooterLinks.tsx');
    expect(footer).toContain("envMode !== 'production'");
    expect(footer).toContain('showDemoLink');
  });
});

describe('Google Play readiness — store sight', () => {
  it('has app identity, splash, scheme, and package configured', () => {
    const appJson = JSON.parse(readSrc('app.json'));
    expect(appJson.expo.name).toBe('CareSuite+');
    expect(appJson.expo.scheme).toBe('caresuiteplus');
    expect(appJson.expo.android?.package).toBe('de.caresuiteplus.app');
    expect(appJson.expo.android?.versionCode).toBeGreaterThan(0);
    expect(appJson.expo.splash?.image).toBe('./assets/splash-icon.png');
    expect(appJson.expo.android?.adaptiveIcon?.foregroundImage).toBeDefined();
  });

  it('support links include privacy, terms, and account deletion route', () => {
    const links = readSrc('src/lib/platform/supportLinks.ts');
    expect(links).toContain('privacy');
    expect(links).toContain('terms');
    expect(readSrc('app/settings/account-deletion.tsx')).toContain('AccountDeletionRequestScreen');
  });

  it('TI/KIM/ePA screens honestly use preparedOnly heroes', () => {
    const tiHero = readSrc('src/components/ti/TIVorbereitungHero.tsx');
    expect(tiHero).toContain('isTILiveReady');
    expect(readSrc('src/screens/ti/EPAVorbereitungScreen.tsx')).toContain('TIVorbereitungHero');
  });

  it('eas.json defines preview and production profiles', () => {
    const eas = JSON.parse(readSrc('eas.json'));
    expect(eas.build.preview).toBeDefined();
    expect(eas.build.production.android.buildType).toBe('app-bundle');
  });
});
