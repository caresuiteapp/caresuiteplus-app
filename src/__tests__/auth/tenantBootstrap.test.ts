import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('tenant bootstrap role resolution', () => {
  it('tenantService resolves role from join, role_id lookup, and session metadata', () => {
    const source = readSrc('src/lib/supabase/tenantService.ts');
    expect(source).toContain('resolveProfileRoleKey');
    expect(source).toContain('fetchRoleKeyById');
    expect(source).toContain('readSessionRoleHint');
    expect(source).toContain("app_metadata?.role_key");
    expect(source).toContain('Benutzerrolle konnte nicht geladen werden.');
  });

  it('RedirectIfAuthenticated waits for session target before redirect', () => {
    const guard = readSrc('src/lib/auth/RedirectIfAuthenticated.tsx');
    expect(guard).toContain('canRedirectHome');
    expect(guard).toContain('!canRedirectHome');
    expect(guard).toContain('resolveAuthSessionTarget');
  });

  it('AppStartScreen keeps authenticated users on start and never signs out', () => {
    const start = readSrc('src/screens/AppStartScreen.tsx');
    expect(start).toContain('resolveAuthSessionTarget');
    expect(start).toContain('Weiterleitung zum Dashboard');
    expect(start).not.toContain('signOut');
    expect(start).not.toMatch(/if \(!hasSessionTarget\) \{\s*void signOut\(\)/);
  });

  it('session target prefers portal session role over stale profile', () => {
    const helper = readSrc('src/lib/auth/sessionTarget.ts');
    expect(helper).toContain('portalSession?.roleKey');
    expect(helper).toContain('Active portal login must win');
  });

  it('session target blocks redirect to public start when role is unknown', () => {
    const helper = readSrc('src/lib/auth/sessionTarget.ts');
    expect(helper).toContain("homePath !== '/'");
  });

  it('AuthProvider repairs profile when session exists without roleKey', () => {
    const provider = readSrc('src/lib/auth/AuthProvider.tsx');
    expect(provider).toContain('repairProfileFromSession');
    expect(provider).toContain('!user || !session || profile?.roleKey');
    expect(provider).toContain('profileRepairAttemptedRef');
  });

  it('RequireRole uses portal session roleKey for access checks', () => {
    const guard = readSrc('src/lib/auth/RequireRole.tsx');
    expect(guard).toContain('resolveEffectiveRoleKey');
    expect(guard).toContain('matchesNavigationTarget');
  });
});
