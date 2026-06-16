import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  defaultPublicVisibility,
  defaultDeveloperVisibility,
  userFriendlyLabel,
  containsForbiddenUiTerm,
} from '@/lib/ui/uiVisibility';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('design system freeze', () => {
  it('StatusBadge maps raw keys to German labels for normal users', () => {
    const publicVis = defaultPublicVisibility();
    const badgeSource = readSrc('src/design/components/StatusBadge.tsx');
    expect(badgeSource).toContain("preparedOnly: UI_PREPARED_LABEL");
    expect(badgeSource).toContain("coming_soon: UI_COMING_SOON_LABEL");
    expect(userFriendlyLabel('preparedOnly')).toBe('Vorbereitet');
    expect(userFriendlyLabel('coming_soon')).toBe('Demnächst');
    expect(userFriendlyLabel('internal')).toBe('Intern');
    expect(publicVis.showDeveloperDiagnostics).toBe(false);
    expect(publicVis.allowForbiddenTerms).toBe(false);
  });

  it('public auth UI has no raw preparedOnly, Supabase, RLS, or Debug strings', () => {
    const authScreens = [
      'src/screens/auth/BusinessLoginScreen.tsx',
      'src/screens/auth/EmployeePortalLoginScreen.tsx',
      'src/screens/auth/PortalCodeLoginScreen.tsx',
      'src/screens/auth/ForgotPasswordScreen.tsx',
      'src/components/auth/AuthLoginHero.tsx',
    ];
    const forbiddenUiPatterns = [
      /portalLabel=["'][^"']*Supabase/i,
      /label=["']preparedOnly/i,
      /title=["'][^"']*RLS/i,
      /message=["'][^"']*Debug/i,
      /subtitle=["'][^"']*Prototyp/i,
      /["']preparedOnly["']/,
      /["']Supabase Auth["']/,
    ];
    for (const file of authScreens) {
      const source = readSrc(file);
      for (const pattern of forbiddenUiPatterns) {
        expect(source).not.toMatch(pattern);
      }
    }
  });

  it('ModuleCard title uses responsive typography without mid-word break hacks', () => {
    const source = readSrc('src/design/components/ModuleCard.tsx');
    expect(source).toContain('numberOfLines={2}');
    expect(source).toContain('flexShrink: 1');
    expect(source).not.toMatch(/wordBreak|break-all|break-word/i);
  });

  it('PremiumButton exposes required variants', () => {
    const source = readSrc('src/components/ui/PremiumButton.tsx');
    for (const variant of ['primary', 'secondary', 'ghost', 'danger', 'prepared']) {
      expect(source).toContain(variant);
    }
  });

  it('start, login, and registration screens use central components', () => {
    const start = readSrc('src/screens/AppStartScreen.tsx');
    expect(start).toContain('PortalCard');
    expect(start).toContain('AppScreen');
    expect(start).toContain('FooterLinks');

    const login = readSrc('src/screens/auth/BusinessLoginScreen.tsx');
    expect(login).toContain('AuthLayout');
    expect(login).toContain('InputField');
    expect(login).toContain('GlassCard');

    const register = readSrc('src/screens/auth/BusinessRegisterScreen.tsx');
    expect(register).toContain('RegisterLayout');
    expect(register).toContain('ModuleCard');
  });

  it('production public visibility hides developer badges and forbidden terms', () => {
    const devVis = defaultDeveloperVisibility();
    const publicVis = defaultPublicVisibility();
    expect(publicVis.showDebugBadges).toBe(false);
    expect(publicVis.showDeveloperDiagnostics).toBe(false);
    expect(devVis.showDeveloperDiagnostics).toBe(true);
    expect(containsForbiddenUiTerm(userFriendlyLabel('preparedOnly'))).toBe(false);
    expect(userFriendlyLabel('preparedOnly')).not.toBe('preparedOnly');
  });

  it('PremiumButton component is exported from design barrel', () => {
    const barrel = readSrc('src/design/components/index.ts');
    const buttonSource = readSrc('src/components/ui/PremiumButton.tsx');
    expect(barrel).toContain('PremiumButton');
    expect(buttonSource).toContain("export function PremiumButton");
  });
});
