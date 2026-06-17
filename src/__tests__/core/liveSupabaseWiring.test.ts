import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  assertTenantForMode,
  getCurrentTenantId,
  requireTenantId,
  resolveTenantIdForService,
} from '@/lib/tenant/tenantResolver';
import { assertLiveConfig, getServiceMode, requireLiveConfig } from '@/lib/services/mode';
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

function stubLiveEnv() {
  vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
}

describe('Live Supabase wiring', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('getServiceMode returns supabase when live env is complete', () => {
    stubLiveEnv();
    expect(getServiceMode()).toBe('supabase');
  });

  it('getServiceMode returns demo when EXPO_PUBLIC_DEMO_MODE=true', () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    expect(getServiceMode()).toBe('demo');
  });

  it('assertLiveConfig fails when demo mode is active', () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    const result = assertLiveConfig();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === 'demo_mode')).toBe(true);
    }
  });

  it('requireLiveConfig throws controlled German error without env', () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', '');
    expect(() => requireLiveConfig()).toThrow(/SUPABASE|Live|fehlt/i);
  });

  it('live mode rejects missing tenant on profile', () => {
    stubLiveEnv();
    const result = resolveTenantIdForService(null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Mandant');
  });

  it('demo mode resolves DEMO_TENANT_ID without profile', () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    const result = resolveTenantIdForService(null);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.tenantId).toBe(DEMO_TENANT_ID);
  });

  it('requireTenantId throws in live without mandant', () => {
    stubLiveEnv();
    expect(() => requireTenantId(null)).toThrow();
    expect(requireTenantId(liveProfile)).toBe(liveProfile.tenantId);
  });

  it('getCurrentTenantId is null in live without mandant', () => {
    stubLiveEnv();
    expect(getCurrentTenantId(null)).toBeNull();
    expect(getCurrentTenantId(liveProfile)).toBe(liveProfile.tenantId);
  });

  it('assertTenantForMode allows any tenant in live', () => {
    stubLiveEnv();
    expect(assertTenantForMode(liveProfile.tenantId!)).toBeNull();
  });

  it('clientService switches repositories via getServiceMode', () => {
    const source = readSrc('lib/services/clients/clientService.ts');
    expect(source).toContain('getServiceMode');
    expect(source).toContain('supabaseClientRepository');
    expect(source).toContain('demoClientRepository');
    expect(source).not.toMatch(/DEMO_TENANT_ID/);
  });

  it('employeeListService uses supabase repo in live path', () => {
    const source = readSrc('lib/office/employeeListService.ts');
    expect(source).toContain('getServiceMode');
    expect(source).toContain('employeeSupabaseRepository');
    expect(source).not.toMatch(/DEMO_TENANT_ID/);
  });

  it('executionService uses supabase repo in live path', () => {
    const source = readSrc('lib/assist/executionService.ts');
    expect(source).toContain('assignmentSupabaseRepository');
    expect(source).toContain('markOnTheWay');
    expect(source).not.toMatch(/DEMO_TENANT_ID/);
  });

  it('tripLogService uses supabase repo in live path', () => {
    const source = readSrc('lib/assist/tripLogService.ts');
    expect(source).toContain('tripSupabaseRepository');
    expect(source).toContain('getServiceMode');
    expect(source).toContain('getDetailMapped');
    expect(source).not.toMatch(/DEMO_TENANT_ID/);
  });

  it('residentListService uses supabase repo in live path', () => {
    const source = readSrc('lib/stationaer/residentListService.ts');
    expect(source).toContain('stationaerSupabaseRepository');
    expect(source).toContain('getServiceMode');
    expect(source).toContain('listMapped');
    expect(source).not.toMatch(/DEMO_TENANT_ID/);
  });

  it('courseListService uses supabase repo in live path', () => {
    const source = readSrc('lib/akademie/courseListService.ts');
    expect(source).toContain('akademieSupabaseRepository');
    expect(source).toContain('getServiceMode');
    expect(source).toContain('listMapped');
    expect(source).not.toMatch(/DEMO_TENANT_ID/);
  });

  it('reportingService uses supabase repo in live path', () => {
    const source = readSrc('lib/reporting/reportingService.ts');
    expect(source).toContain('reportingSupabaseRepository');
    expect(source).toContain('getServiceMode');
    expect(source).toContain('listMapped');
    expect(source).toContain('getDetailMapped');
    expect(source).not.toMatch(/REPORTING_DEMO_TENANT/);
  });

  it('invoiceCreateService uses supabase repo in live path', () => {
    const source = readSrc('lib/office/invoiceCreateService.ts');
    expect(source).toContain('invoiceSupabaseRepository');
    expect(source).not.toMatch(/DEMO_TENANT_ID/);
  });

  it('budgetListService uses supabase repo in live path', () => {
    const source = readSrc('lib/office/budgetListService.ts');
    expect(source).toContain('getServiceMode');
    expect(source).toContain('budgetSupabaseRepository');
    expect(source).not.toMatch(/DEMO_TENANT_ID/);
    expect(source).not.toContain('Budgets im Live-Modus noch nicht angebunden');
  });

  it('templateService uses repo switch without DEMO_TENANT_ID', () => {
    const source = readSrc('lib/templates/templateService.ts');
    expect(source).toContain('getServiceMode');
    expect(source).not.toMatch(/DEMO_TENANT_ID/);
  });

  it('communication service uses assertTenantForMode', () => {
    const source = readSrc('features/communication/communication.service.ts');
    expect(source).toContain('assertTenantForMode');
    expect(source).toContain('getServiceMode');
  });

  it('qmRepository supabase exists for live CRUD', () => {
    const source = readSrc('lib/qm/qmRepository.supabase.ts');
    expect(source).toContain('getSupabaseClient');
  });

  it('ti audit service persists in live via supabase repo', () => {
    const source = readSrc('lib/ti/tiAuditService.ts');
    expect(source).toContain('tiAuditSupabaseRepository');
    expect(source).toContain('getServiceMode');
  });

  it('ti provider live path returns provider_required', () => {
    const source = readSrc('lib/ti/tiProviderService.ts');
    expect(source).toContain('provider_required');
  });

  it('redirects isProductActive requires explicit tenantId', () => {
    const source = readSrc('lib/navigation/redirects.ts');
    expect(source).not.toMatch(/DEMO_TENANT_ID/);
    expect(source).toContain('tenantId: string | null | undefined');
  });

  it('P0 hooks avoid hardcoded DEMO_TENANT_ID', () => {
    for (const hook of [
      'useClientList.ts',
      'useInvoiceList.ts',
      'useEmployeeList.ts',
      'useReportList.ts',
      'useReportDetail.ts',
      'templates/useTemplates.ts',
    ]) {
      const source = readSrc(`hooks/${hook}`);
      expect(source).toContain('useServiceTenantId');
      expect(source).not.toMatch(/DEMO_TENANT_ID/);
      expect(source).not.toMatch(/REPORTING_DEMO_TENANT/);
    }
  });

  it('isDemoMode is boolean', () => {
    expect(typeof isDemoMode()).toBe('boolean');
  });
});
