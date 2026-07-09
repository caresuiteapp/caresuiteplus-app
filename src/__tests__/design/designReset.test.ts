import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { userFriendlyLabel } from '@/lib/ui/uiVisibility';
import { galaxyPalette } from '@/design/tokens/galaxy';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Design Reset (Prompt 101)', () => {
  it('galaxy palette defines core space colors', () => {
    expect(galaxyPalette.deepSpace).toBe('#F8FAFC');
    expect(galaxyPalette.careOrange).toBe('#FF6B1A');
    expect(galaxyPalette.galaxyCyan).toBe('#22D3EE');
  });

  it('StatusBadge maps preparedOnly to Vorbereitet', () => {
    expect(userFriendlyLabel('preparedOnly')).toBe('Vorbereitet');
    expect(userFriendlyLabel('comingSoon')).toBe('Demnächst');
    const badge = readSrc('src/design/components/StatusBadge.tsx');
    expect(badge).toContain('UI_PREPARED_LABEL');
  });

  it('AppStartScreen uses premium space shell and glass portal cards', () => {
    const source = readSrc('src/screens/AppStartScreen.tsx');
    expect(source).toContain('AppScreen');
    expect(source).toContain('PortalCard');
    expect(source).toContain('fetchAppStartSnapshot');
    const portal = readSrc('src/design/components/PortalCard.tsx');
    expect(portal).toContain('GlassCard');
    expect(portal).toContain('CareSuiteIcon');
  });

  it('Business login renders without broken prototype text patterns', () => {
    const source = readSrc('src/screens/auth/BusinessLoginScreen.tsx');
    expect(source).toContain('AuthLayout');
    expect(source).toContain('InputField');
    expect(source).not.toContain('Prototyp');
    expect(source).not.toContain('preparedOnly Auth');
  });

  it('Business register shows Office always active', () => {
    const source = readSrc('src/screens/auth/BusinessRegisterScreen.tsx');
    expect(source).toContain('immer enthalten');
    expect(source).toContain("module === 'office'");
    expect(source).toContain('PremiumButton');
  });

  it('PremiumPreparedNotice labels premium connectors', () => {
    const notice = readSrc('src/components/billing/PremiumPreparedNotice.tsx');
    expect(notice).toContain('PremiumBadge');
    expect(notice).toContain('preparedOnly');
    expect(notice).toContain('DATEV');
    expect(notice).toContain('KIM');
  });

  it('auth routes remain reachable via canonical paths', () => {
    expect(readSrc('app/auth/business-login.tsx')).toContain('BusinessLoginScreen');
    expect(readSrc('app/auth/register-business.tsx')).toContain('BusinessRegisterScreen');
    expect(readSrc('app/auth/forgot-password.tsx')).toContain('ForgotPasswordScreen');
  });

  it('design system exports care tokens and components', () => {
    expect(readSrc('src/design/tokens/index.ts')).toContain('careSuiteColors');
    expect(readSrc('src/design/components/index.ts')).toContain('SpaceBackground');
    expect(readSrc('src/design/components/index.ts')).toContain('GlassCard');
    expect(readSrc('src/design/components/index.ts')).toContain('AuthPageShell');
  });
});
