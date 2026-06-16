import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  sanitizeUiText,
  userFriendlyLabel,
} from '@/lib/ui/uiVisibility';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

const AUTH_UI_FILES = [
  'src/screens/AppStartScreen.tsx',
  'src/screens/auth/BusinessLoginScreen.tsx',
  'src/screens/auth/BusinessRegisterScreen.tsx',
  'src/screens/auth/EmployeePortalLoginScreen.tsx',
  'src/screens/auth/PortalCodeLoginScreen.tsx',
  'src/screens/auth/ForgotPasswordScreen.tsx',
  'src/components/auth/AuthLoginHero.tsx',
  'src/components/billing/PremiumPreparedNotice.tsx',
];

describe('Auth UI quality audit (Prompt 102)', () => {
  it('maps internal preparedOnly keys to German labels', () => {
    expect(userFriendlyLabel('preparedOnly')).toBe('Vorbereitet');
    expect(userFriendlyLabel('preparedOnly Auth')).toBe('Auth vorbereitet');
    expect(sanitizeUiText('preparedOnly')).toBe('Vorbereitet');
  });

  it('public auth screens do not expose raw preparedOnly strings', () => {
    for (const file of AUTH_UI_FILES) {
      const source = readSrc(file);
      expect(source).not.toMatch(/label="preparedOnly"/);
      expect(source).not.toContain("'preparedOnly'");
    }
  });

  it('KPI cards guard value typography against mid-word breaks', () => {
    const premiumKpi = readSrc('src/components/ui/PremiumKpiCard.tsx');
    const lightKpi = readSrc('src/components/ui/CareLightKpiCard.tsx');
    expect(premiumKpi).toContain('numberOfLines={1}');
    expect(premiumKpi).toContain('flexShrink: 0');
    expect(lightKpi).toContain('numberOfLines={1}');
    expect(lightKpi).toContain('flexShrink: 0');
  });

  it('registration uses glass module cards not plain white buttons', () => {
    const register = readSrc('src/screens/auth/BusinessRegisterScreen.tsx');
    expect(register).toContain('ModuleCard');
    expect(register).toContain('RegisterLayout');
    expect(register).toContain('PremiumPreparedNotice');
  });

  it('business login uses secure enterprise shell', () => {
    const login = readSrc('src/screens/auth/BusinessLoginScreen.tsx');
    expect(login).toContain('AuthLayout');
    expect(login).toContain('GlassCard');
    expect(login).toContain('InputField');
    expect(login).not.toContain('AuthLoginHero');
  });
});
