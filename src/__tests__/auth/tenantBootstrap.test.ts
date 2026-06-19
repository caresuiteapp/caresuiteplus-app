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
    expect(guard).toContain('<Redirect href={homePath');
    expect(guard).toContain('authReady');
  });

  it('AppStartScreen keeps authenticated users on start and never signs out', () => {
    const start = readSrc('src/screens/AppStartScreen.tsx');
    expect(start).toContain('resolveAuthSessionTarget');
    expect(start).toContain('<Redirect href={homePath');
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
    expect(helper).toContain('BUSINESS_FALLBACK_HOME');
  });

  it('AuthProvider repairs profile when session exists without roleKey', () => {
    const provider = readSrc('src/lib/auth/AuthProvider.tsx');
    expect(provider).toContain('repairProfileFromSession');
    expect(provider).toContain('!user || !session || profile?.roleKey');
    expect(provider).toContain('profileRepairAttemptedRef');
  });

  it('AuthProvider ignores transient null auth events and keeps restore session', () => {
    const provider = readSrc('src/lib/auth/AuthProvider.tsx');
    expect(provider).toContain('shouldClearAuthOnNullSessionEvent');
    expect(provider).toContain('buildMinimalAuthState');
    expect(provider).not.toContain('await supabaseSignOut();\n          }');
  });

  it('AuthProvider exposes authReady and keeps minimal session on bootstrap miss', () => {
    const provider = readSrc('src/lib/auth/AuthProvider.tsx');
    expect(provider).toContain('authReady: isInitialized && !isLoading');
    expect(provider).toContain('buildMinimalAuthState(supabaseSession)');
    expect(provider).not.toContain("throw new Error('Benutzerprofil konnte nicht geladen werden.')");
  });

  it('auth index never sends authenticated users to public start', () => {
    const authIndex = readSrc('app/auth/index.tsx');
    expect(authIndex).toContain('authReady');
    expect(authIndex).toContain('Weiterleitung zum Dashboard');
    expect(authIndex).toContain('<Redirect href={homePath as never} />');
    expect(authIndex).not.toContain('<Redirect href="/" as never />');
  });

  it('RequireRole uses portal session roleKey for access checks', () => {
    const guard = readSrc('src/lib/auth/RequireRole.tsx');
    expect(guard).toContain('resolveEffectiveRoleKey');
    expect(guard).toContain('matchesNavigationTarget');
    expect(guard).toContain('!roleKey');
    expect(guard).not.toContain("router.replace('/' as never)");
  });
});
