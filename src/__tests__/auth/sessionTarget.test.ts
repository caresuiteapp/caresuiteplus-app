import { describe, expect, it } from 'vitest';
import { resolveAuthSessionTarget } from '@/lib/auth/sessionTarget';

describe('resolveAuthSessionTarget', () => {
  it('redirects business users away from public start', () => {
    const target = resolveAuthSessionTarget({
      profile: { roleKey: 'business_admin' } as never,
      portalSession: null,
      user: null,
    });

    expect(target.homePath).toBe('/business');
    expect(target.canRedirectHome).toBe(true);
  });

  it('uses user roleKey when profile roleKey is missing', () => {
    const target = resolveAuthSessionTarget({
      profile: null,
      portalSession: null,
      user: { roleKey: 'business_admin' } as never,
    });

    expect(target.hasSessionTarget).toBe(true);
    expect(target.homePath).toBe('/business');
    expect(target.canRedirectHome).toBe(true);
  });

  it('does not redirect authenticated users back to public start', () => {
    const target = resolveAuthSessionTarget({
      profile: null,
      portalSession: null,
      user: null,
    });

    expect(target.homePath).toBe('/');
    expect(target.canRedirectHome).toBe(false);
  });
});
