import { describe, expect, it } from 'vitest';
import {
  generatePortalCode,
  normalizePortalCodeInput,
  validatePortalCodeFormat,
  pickUniquePortalCode,
  maskPortalCodeHint,
} from '@/lib/auth/portalCodeGenerator';
import { PORTAL_CODE_CHARSET, PORTAL_CODE_LENGTH } from '@/lib/auth/auth.types';

describe('portalCodeGenerator', () => {
  it('generates 6-character codes from allowed charset', () => {
    const code = generatePortalCode();
    expect(code).toHaveLength(PORTAL_CODE_LENGTH);
    expect(/^[A-Z0-9]{6}$/.test(code)).toBe(true);
    for (const char of code) {
      expect(PORTAL_CODE_CHARSET.includes(char)).toBe(true);
    }
  });

  it('normalizes user input', () => {
    expect(normalizePortalCodeInput(' a7k2p9 ')).toBe('A7K2P9');
    expect(normalizePortalCodeInput('a7-k2.p9')).toBe('A7K2P9');
  });

  it('validates portal code format', () => {
    expect(validatePortalCodeFormat('A7K2P9')).toBeNull();
    expect(validatePortalCodeFormat('ABC')).toMatch(/6-stellig/);
    expect(validatePortalCodeFormat('ABC-12')).toMatch(/6-stellig/);
  });

  it('picks unique codes', () => {
    const existing = ['A7K2P9', '39FQ8L'];
    const code = pickUniquePortalCode(existing);
    expect(existing).not.toContain(code);
  });

  it('masks code hints safely', () => {
    expect(maskPortalCodeHint('A7K2P9')).toBe('A7****');
    expect(maskPortalCodeHint('A')).toBe('******');
  });
});
