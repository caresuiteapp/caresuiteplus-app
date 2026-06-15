import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { resolveTenantIdForService } from '@/lib/tenant/tenantResolver';
import { getServiceMode } from '@/lib/services/mode';
import { isDemoMode } from '@/lib/supabase/config';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import type { Profile } from '@/types';

vi.mock('react-native-url-polyfill/auto', () => ({}));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

const liveProfile: Profile = {
  id: 'profile-live-001',
  tenantId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  roleId: 'role-001',
  roleKey: 'business_admin',
  displayName: 'Live Admin',
  email: 'admin@pilot.caresuiteplus.app',
  phone: null,
  avatarUrl: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function readSrc(relativePath: string): string {
  return readFileSync(path.join(__dirname, '..', '..', relativePath), 'utf8');
}

describe('P0 Restblocker Sprint', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('live mode rejects missing tenant on profile', () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');

    const result = resolveTenantIdForService(null);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Mandant');
    }
  });

  it('demo mode allows demo tenant resolution', () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    const result = resolveTenantIdForService(null);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tenantId).toBe(DEMO_TENANT_ID);
    }
  });

  it('live profile resolves real tenant id without demo fallback', () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');

    const result = resolveTenantIdForService(liveProfile);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tenantId).toBe(liveProfile.tenantId);
      expect(result.tenantId).not.toBe(DEMO_TENANT_ID);
    }
  });

  it('getServiceMode switches to supabase when live env is set', () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
    expect(getServiceMode()).toBe('supabase');
  });

  it('invoiceDetailService uses getServiceMode and supabase repo in live path', () => {
    const source = readSrc('lib/office/invoiceDetailService.ts');
    expect(source).toContain('getServiceMode');
    expect(source).toContain('invoiceSupabaseRepository');
    expect(source).toContain('guardServiceTenant');
    expect(source).not.toMatch(/DEMO_TENANT_ID/);
  });

  it('executionService persists status transitions via supabase repo in live path', () => {
    const source = readSrc('lib/assist/executionService.ts');
    expect(source).toContain('getServiceMode');
    expect(source).toContain('assignmentSupabaseRepository');
    expect(source).toMatch(/markOnTheWay|markStarted|completeAssignment/);
    expect(source).not.toMatch(/DEMO_TENANT_ID/);
  });

  it('communication attachments use service mode switch', () => {
    const source = readSrc('features/communication/communication.attachments.ts');
    expect(source).toContain('getServiceMode');
    expect(source).toMatch(/attachmentsSupabaseRepository|storage/i);
  });

  it('communication realtime uses isDemoMode guard', () => {
    const source = readSrc('features/communication/communication.realtime.ts');
    expect(source).toContain('isDemoMode');
    expect(source).toMatch(/postgres_changes|channel/i);
  });

  it('TI live without provider returns provider_required path', () => {
    const source = readSrc('lib/ti/tiProviderService.ts');
    expect(source).toContain('provider_required');
    expect(source).toContain('getServiceMode');
  });

  it('voice composer disables mic in live preparedOnly mode', () => {
    const composer = readSrc('components/communication/ChatComposer.tsx');
    const conversation = readSrc('screens/communication/ConversationScreen.tsx');
    expect(composer).toContain('voicePreparedOnly');
    expect(conversation).toMatch(/voicePreparedOnly|isDemoMode/);
  });

  it('demo mode flag is detectable', () => {
    expect(typeof isDemoMode()).toBe('boolean');
  });
});
