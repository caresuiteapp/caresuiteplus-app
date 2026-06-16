import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  containsForbiddenUiTerm,
  defaultPublicVisibility,
  defaultRegisteringVisibility,
  getUiVisibilityForRole,
  resolveVisibleLabel,
  sanitizeUiText,
  userFriendlyLabel,
} from '@/lib/ui/uiVisibility';
import { APP_START_ENTRIES } from '@/data/landing/appStartEntries';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

const FORBIDDEN_ON_PUBLIC = [
  'preparedOnly',
  'RLS',
  'Supabase',
  'Prototyp',
  'Kein Store-Release',
  'Demo-Prototyp',
];

describe('UI visibility (Prompt 103)', () => {
  it('maps preparedOnly to Vorbereitet', () => {
    expect(userFriendlyLabel('preparedOnly')).toBe('Vorbereitet');
    expect(userFriendlyLabel('preparedOnly Auth')).toBe('Auth vorbereitet');
  });

  it('hides raw technical terms from public visibility', () => {
    const visibility = defaultPublicVisibility();
    expect(visibility.showDeveloperDiagnostics).toBe(false);
    expect(visibility.showPreparedBadges).toBe(false);
    expect(visibility.allowForbiddenTerms).toBe(false);
    expect(resolveVisibleLabel('preparedOnly Auth', visibility)).toBeNull();
    expect(resolveVisibleLabel('RLS', visibility)).toBeNull();
  });

  it('allows prepared labels for registering users without raw keys', () => {
    const visibility = defaultRegisteringVisibility();
    expect(visibility.showPreparedBadges).toBe(true);
    const label = resolveVisibleLabel('preparedOnly', visibility);
    expect(label).toBe('Vorbereitet');
    expect(label).not.toContain('preparedOnly');
  });

  it('production public users see no demo/debug badges', () => {
    const visibility = getUiVisibilityForRole('public_user', 'production');
    expect(visibility.showDemoModeBanner).toBe(false);
    expect(visibility.showDebugBadges).toBe(false);
    expect(visibility.showDeveloperDiagnostics).toBe(false);
  });

  it('developer role can see diagnostics outside production', () => {
    const visibility = getUiVisibilityForRole('developer', 'pilot');
    expect(visibility.showDeveloperDiagnostics).toBe(true);
    expect(visibility.showRlsInfo).toBe(true);
  });

  it('sanitizeUiText removes forbidden terms from normal copy', () => {
    const cleaned = sanitizeUiText('preparedOnly Auth mit Supabase RLS — Prototyp');
    for (const term of FORBIDDEN_ON_PUBLIC) {
      expect(cleaned.toLowerCase()).not.toContain(term.toLowerCase());
    }
    expect(containsForbiddenUiTerm(cleaned)).toBe(false);
  });
});

describe('Public start page (Prompt 103)', () => {
  it('AppStartScreen has no raw technical terms or duplicate demo CTA', () => {
    const screen = readSrc('src/screens/AppStartScreen.tsx');
    for (const term of FORBIDDEN_ON_PUBLIC) {
      expect(screen).not.toContain(term);
    }
    expect(screen).not.toContain('Demo-Dashboard öffnen');
    expect(screen).not.toContain('Modul suchen');
    expect(screen).toContain('PortalCard');
    expect(screen).toContain('FooterLinks');
  });

  it('defines four portal cards without inline demo entry', () => {
    expect(APP_START_ENTRIES).toHaveLength(4);
    expect(APP_START_ENTRIES.some((e) => e.path.includes('demo'))).toBe(false);
  });

  it('footer links stay compact without duplicate register CTA', () => {
    const footer = readSrc('src/design/components/FooterLinks.tsx');
    expect(footer).toContain('Demo');
    expect(footer).toContain('Datenschutz');
    expect(footer).toContain('Impressum');
    expect(footer).toContain('Nutzungsbedingungen');
    expect(footer).not.toContain('register-business');
  });
});

describe('Business login cleanup (Prompt 103)', () => {
  it('AuthLoginHero removes Mandant/RLS/Prototyp KPI panels', () => {
    const hero = readSrc('src/components/auth/AuthLoginHero.tsx');
    expect(hero).not.toContain('PremiumKpiCard');
    expect(hero).not.toContain('RLS');
    expect(hero).not.toContain('Supabase Auth');
    expect(hero).not.toContain('Kein Store-Release');
    expect(hero).toContain('sanitizeUiText');
    expect(hero).toContain('AuthHero');
  });

  it('BusinessLoginScreen has single register CTA and no breadcrumbs', () => {
    const screen = readSrc('src/screens/auth/BusinessLoginScreen.tsx');
    expect(screen).toContain('Neues Unternehmen registrieren');
    expect((screen.match(/register-business/g) ?? []).length).toBe(1);
    expect(screen).not.toContain('Interner Mandantenzugang');
    expect(screen).not.toContain('preparedOnly');
  });
});

describe('Registration cleanup (Prompt 103)', () => {
  it('BusinessRegisterScreen shows friendly module cards not preparedOnly', () => {
    const screen = readSrc('src/screens/auth/BusinessRegisterScreen.tsx');
    expect(screen).toContain('ModuleCard');
    expect(screen).not.toContain('preparedOnly');
    expect(screen).toContain("module === 'office'");
    expect(screen).toContain('comingSoon');
  });

  it('PremiumPreparedNotice uses friendly label not raw badge', () => {
    const notice = readSrc('src/components/billing/PremiumPreparedNotice.tsx');
    expect(notice).toContain('Demnächst verfügbar');
    expect(notice).not.toContain('label="preparedOnly"');
  });
});

describe('Auth heroes no developer badges for normal users', () => {
  it('OnboardingWelcomeHero hides Demo-Prototyp badge', () => {
    const hero = readSrc('src/components/auth/OnboardingWelcomeHero.tsx');
    expect(hero).not.toContain('Demo-Prototyp');
    expect(hero).not.toContain('Kein Store-Release');
  });

  it('DemoLoginHero hides preparedOnly and Prototyp for public visibility', () => {
    const hero = readSrc('src/components/auth/DemoLoginHero.tsx');
    expect(hero).not.toContain('preparedOnly');
    expect(hero).not.toContain('Prototyp');
    expect(hero).not.toContain('Kein Supabase');
  });
});
