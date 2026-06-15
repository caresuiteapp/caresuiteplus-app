import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assertTenantForMode,
  getCurrentTenantId,
  requireTenantId,
  resolveTenantIdForService,
} from '@/lib/tenant/tenantResolver';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import type { Profile } from '@/types';

const liveProfile: Profile = {
  id: 'profile-live-001',
  tenantId: 'tenant-live-001',
  roleId: 'role-001',
  roleKey: 'business_admin',
  displayName: 'Live Admin',
  email: 'admin@pilot.caresuiteplus.app',
  phone: null,
  avatarUrl: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('Tenant resolver', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('liefert DEMO_TENANT_ID im Demo-Modus unabhängig vom Profil', () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    const result = resolveTenantIdForService(null);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.tenantId).toBe(DEMO_TENANT_ID);
  });

  it('verlangt profile.tenant_id im Live-Modus', () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'test-key');

    const missing = resolveTenantIdForService({ ...liveProfile, tenantId: null });
    expect(missing.ok).toBe(false);

    const resolved = resolveTenantIdForService(liveProfile);
    expect(resolved.ok).toBe(true);
    if (resolved.ok) expect(resolved.tenantId).toBe('tenant-live-001');
  });

  it('requireTenantId wirft im Live-Modus ohne Mandant', () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'test-key');

    expect(() => requireTenantId({ ...liveProfile, tenantId: null })).toThrow();
    expect(requireTenantId(liveProfile)).toBe('tenant-live-001');
  });

  it('getCurrentTenantId gibt null zurück wenn Live ohne Mandant', () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'test-key');

    expect(getCurrentTenantId({ ...liveProfile, tenantId: null })).toBeNull();
    expect(getCurrentTenantId(liveProfile)).toBe('tenant-live-001');
  });

  it('assertTenantForMode blockiert falschen Demo-Mandanten', () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    const err = assertTenantForMode('wrong-tenant');
    expect(err?.ok).toBe(false);
    expect(assertTenantForMode(DEMO_TENANT_ID)).toBeNull();
  });
});
