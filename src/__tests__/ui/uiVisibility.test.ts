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

  it('strips snake_case identifiers from user-facing copy', () => {
    expect(sanitizeUiText('assist_routes / assist_route_items')).toBe('');
    expect(sanitizeUiText('changed_after_export')).toBe('nach Export geändert');
    expect(userFriendlyLabel('Demo / preparedOnly')).toBe('Demo');
  });

  it('hides raw technical terms from public visibility', () => {
    const visibility = defaultPublicVisibility();
    expect(visibility.showDeveloperDiagnostics).toBe(false);
    expect(visibility.showPreparedBadges).toBe(false);
    expect(visibility.allowForbiddenTerms).toBe(false);
    expect(resolveVisibleLabel('preparedOnly Auth', visibility)).toBeNull();
    expect(resolveVisibleLabel('Prototyp', visibility)).toBeNull();
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
  it('AppStartScreen has no raw technical terms in user-visible copy', () => {
    const screen = readSrc('src/screens/AppStartScreen.tsx');
    const userVisible = screen
      .split('\n')
      .filter((line) => !line.trim().startsWith('import ') && !line.includes('useSupabase'));
    const visibleText = userVisible.join('\n');
    for (const term of FORBIDDEN_ON_PUBLIC) {
      expect(visibleText).not.toContain(term);
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

  it('footer links stay compact without demo entry in live-only mode', () => {
    const footer = readSrc('src/design/components/FooterLinks.tsx');
    expect(footer).not.toContain('Demo ansehen');
    expect(footer).not.toContain('/auth/demo');
    expect(footer).toContain('Datenschutz');
    expect(footer).toContain('Impressum');
    expect(footer).toContain('Nutzungsbedingungen');
    expect(footer).toContain('Version');
    expect(footer).not.toContain('register-business');
  });
});

describe('Business login cleanup (Prompt 103)', () => {
  it('AuthLoginHero uses premium list hero frame', () => {
    const hero = readSrc('src/components/auth/AuthLoginHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('AuthLoginHero');
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
  it('BusinessRegisterScreen shows module selection without raw preparedOnly keys', () => {
    const screen = readSrc('src/screens/auth/BusinessRegisterScreen.tsx');
    expect(screen).toContain('MODULE_OPTIONS');
    expect(screen).not.toContain('preparedOnly');
    expect(screen).toContain("module === 'office'");
    expect(screen).toContain('AuthRegisterHero');
  });

  it('PremiumPreparedNotice documents premium connectors', () => {
    const notice = readSrc('src/components/billing/PremiumPreparedNotice.tsx');
    expect(notice).toContain('DATEV');
    expect(notice).toContain('KIM');
  });
});

describe('Auth heroes no developer badges for normal users', () => {
  it('OnboardingWelcomeHero uses welcome copy', () => {
    const hero = readSrc('src/components/auth/OnboardingWelcomeHero.tsx');
    expect(hero).toContain('OnboardingWelcomeHero');
    expect(hero).not.toContain('Kein Store-Release');
  });

  it('demo login hero removed in live-only mode', () => {
    expect(() => readSrc('src/components/auth/DemoLoginHero.tsx')).toThrow();
  });
});
