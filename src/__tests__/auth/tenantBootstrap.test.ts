import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

vi.mock('react-native-url-polyfill/auto', () => ({}));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

import {
  PROFILE_SELECT,
  resolveProfileDisplayName,
  resolveProfileRoleKey,
} from '@/lib/supabase/tenantService';
import { mapCanonicalRoleToRoleKey, mapLegacyRoleKeyToRoleKey } from '@/lib/permissions/workspaceRoles';

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

  it('queries live profiles without legacy role_key/display_name columns', () => {
    expect(PROFILE_SELECT).toContain('full_name');
    expect(PROFILE_SELECT).toContain('first_name');
    expect(PROFILE_SELECT).toContain('roles(key)');
    expect(PROFILE_SELECT).not.toContain('role_key');
    expect(PROFILE_SELECT).not.toContain('display_name');
  });

  it('maps live owner role key to business_admin', () => {
    expect(mapCanonicalRoleToRoleKey('owner')).toBe('business_admin');
  });

  it('maps legacy planning role key to dispatch', () => {
    expect(mapLegacyRoleKeyToRoleKey('planning')).toBe('dispatch');
    expect(mapLegacyRoleKeyToRoleKey('owner')).toBe('business_admin');
  });

  it('resolveProfileDisplayName prefers full_name over email', () => {
    expect(
      resolveProfileDisplayName({
        id: 'p1',
        tenant_id: 't1',
        role_id: null,
        first_name: 'Kevin',
        last_name: 'Reinhardt',
        full_name: 'Kevin Reinhardt',
        email: 'kevin@helferhasen.app',
        phone: null,
        avatar_url: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        roles: null,
      }),
    ).toBe('Kevin Reinhardt');
  });

  it('resolveProfileRoleKey resolves owner via roles join', async () => {
    const client = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
    };

    const roleKey = await resolveProfileRoleKey(
      client as never,
      {
        id: 'p1',
        tenant_id: 't1',
        role_id: 'role-1',
        first_name: 'Kevin',
        last_name: 'Reinhardt',
        full_name: 'Kevin Reinhardt',
        email: 'kevin@helferhasen.app',
        phone: null,
        avatar_url: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        roles: { key: 'owner' },
      },
      { user: { app_metadata: {}, user_metadata: {} } } as never,
    );

    expect(roleKey).toBe('business_admin');
  });

  it('resolveProfileRoleKey prefers portal JWT over stale owner profile', async () => {
    const client = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
    };

    const roleKey = await resolveProfileRoleKey(
      client as never,
      {
        id: 'p1',
        tenant_id: 't1',
        role_id: 'role-1',
        first_name: 'Klient',
        last_name: 'Portal',
        full_name: 'Klient Portal',
        email: 'portal.client.test@caresuite-portal.local',
        phone: null,
        avatar_url: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        roles: { key: 'owner' },
      },
      {
        user: {
          app_metadata: { role_key: 'client_portal' },
          user_metadata: {},
        },
      } as never,
    );

    expect(roleKey).toBe('client_portal');
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
    expect(provider).toContain('profileBootstrapError');
    expect(provider).toContain('retryProfileBootstrap');
  });

  it('AuthProvider ignores transient null auth events and keeps restore session', () => {
    const provider = readSrc('src/lib/auth/AuthProvider.tsx');
    expect(provider).toContain('shouldClearAuthOnNullSessionEvent');
    expect(provider).toContain('buildMinimalAuthState');
    expect(provider).not.toContain('await supabaseSignOut();\n          }');
  });

  it('AuthProvider reconciles live Supabase session when context is behind', () => {
    const provider = readSrc('src/lib/auth/AuthProvider.tsx');
    expect(provider).toContain('reconcileLiveSession');
    expect(provider).toContain('authReady: isInitialized && !isLoading');
    expect(provider).toContain('withAuthBootstrapTimeout');
    expect(provider).toContain('void restoreSupabaseSession');
    expect(provider).toContain("'Portal-Sitzung'");
    expect(provider).toContain('4_000');
    expect(provider).toContain("'Portal-Sitzung löschen'");
  });

  it('Supabase auth requests cannot leave login or guards loading forever', () => {
    const authService = readSrc('src/lib/supabase/authService.ts');
    expect(authService).toContain('AUTH_REQUEST_TIMEOUT_MS');
    expect(authService).toContain("withAuthRequestTimeout(client.auth.getSession(), 'Sitzungsprüfung')");
    expect(authService).toContain("'Anmeldung'");
  });

  it('login audit persistence cannot block authentication indefinitely', () => {
    const audit = readSrc('src/lib/auth/loginAuditService.ts');
    expect(audit).toContain('LOGIN_AUDIT_TIMEOUT_MS');
    expect(audit).toContain('Promise.race');
    expect(audit).toContain('setTimeout(resolve, LOGIN_AUDIT_TIMEOUT_MS)');
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
    expect(guard).toContain('profileBootstrapError');
    expect(guard).toContain('retryProfileBootstrap');
    expect(guard).not.toContain("router.replace('/' as never)");
  });

  it('permissions index has no duplicate export blocks', () => {
    const source = readSrc('src/lib/permissions/index.ts');
    expect(source.split("from './workspaceRoles';").length - 1).toBe(1);
    expect(source.split("from './workspaceAccess';").length - 1).toBe(1);
    expect(source.split("from './roleMatrixService';").length - 1).toBe(1);
  });
});
