import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import {
  fetchModuleAssignmentHub,
  fetchModuleAssignmentList,
} from '@/lib/officeModules/moduleAssignmentService';
import { officeCoreSupabaseRepository } from '@/lib/officeCore/supabaseRepository';

vi.mock('react-native-url-polyfill/auto', () => ({}));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

const LIVE_TENANT_ID = '56180c22-b894-4fab-b55e-a563c94dd6e7';

describe('module assignments live mode', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('returns demo hub data in demo mode', async () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');

    const result = await fetchModuleAssignmentHub(DEMO_TENANT_ID, 'business_admin');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.length).toBe(7);
      expect(result.data.some((section) => section.count > 0)).toBe(true);
    }
  });

  it('returns empty live hub without live-mode blocker error', async () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');

    vi.spyOn(officeCoreSupabaseRepository.clientModuleAssignments, 'list').mockResolvedValue({
      ok: true,
      data: [],
    });
    vi.spyOn(officeCoreSupabaseRepository.employeeModuleAssignments, 'list').mockResolvedValue({
      ok: true,
      data: [],
    });
    vi.spyOn(officeCoreSupabaseRepository.moduleServiceCatalog, 'list').mockResolvedValue({
      ok: true,
      data: [],
    });
    vi.spyOn(officeCoreSupabaseRepository.moduleBillingSources, 'list').mockResolvedValue({
      ok: true,
      data: [],
    });
    vi.spyOn(officeCoreSupabaseRepository.moduleDocumentVisibility, 'list').mockResolvedValue({
      ok: true,
      data: [],
    });
    vi.spyOn(officeCoreSupabaseRepository.moduleTemplateAssignments, 'list').mockResolvedValue({
      ok: true,
      data: [],
    });
    vi.spyOn(officeCoreSupabaseRepository.modulePermissionProfiles, 'list').mockResolvedValue({
      ok: true,
      data: [],
    });

    const hub = await fetchModuleAssignmentHub(LIVE_TENANT_ID, 'business_admin');
    expect(hub.ok).toBe(true);
    if (hub.ok) {
      expect(hub.data.length).toBe(7);
      expect(hub.data.every((section) => section.count === 0)).toBe(true);
    }

    const list = await fetchModuleAssignmentList(LIVE_TENANT_ID, 'clients', 'business_admin');
    expect(list.ok).toBe(true);
    if (list.ok) {
      expect(list.data).toEqual([]);
    }
  });

  it('does not return the live-mode stub error message', async () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');

    vi.spyOn(officeCoreSupabaseRepository.clientModuleAssignments, 'list').mockResolvedValue({
      ok: true,
      data: [],
    });

    const result = await fetchModuleAssignmentList(LIVE_TENANT_ID, 'clients', 'business_admin');
    if (!result.ok) {
      expect(result.error).not.toMatch(/noch nicht vollständig angebunden/);
    }
  });
});
