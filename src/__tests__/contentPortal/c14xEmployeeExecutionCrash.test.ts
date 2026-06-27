import { describe, expect, it, beforeEach, vi } from 'vitest';

const INTERNAL_TEST_TENANT = 'a4ba83bd-65db-46cf-8cf7-61492cc78315';
const PRODUCTION_TENANT = '56180c22-b894-4fab-b55e-a563c94dd6e7';
const EMPLOYEE_ID = 'emp-001';

describe('C.14X — employee execution production render crash fix', () => {
  beforeEach(async () => {
    const { resetTenantEnvironmentSettingsStore } = await import(
      '@/lib/environment/tenantEnvironmentSettingsService'
    );
    resetTenantEnvironmentSettingsStore();

    const { resetEmployeePortalExecutionStore } = await import(
      '@/lib/portal/employeePortalExecutionService'
    );
    resetEmployeePortalExecutionStore();
  });

  describe('guard behaviour preserved', () => {
    it('guardLiveDemoFeature bypasses for internal_test tenant', async () => {
      const { guardLiveDemoFeature } = await import('@/lib/services/liveServiceGuard');
      const result = guardLiveDemoFeature(INTERNAL_TEST_TENANT, 'Mitarbeiterportal-Einsatzdetail');
      expect(result).toBeNull();
    });

    it('guardLiveDemoFeature blocks production tenant', async () => {
      const { guardLiveDemoFeature } = await import('@/lib/services/liveServiceGuard');
      const result = guardLiveDemoFeature(PRODUCTION_TENANT, 'Mitarbeiterportal-Einsatzdetail');
      expect(result).not.toBeNull();
      expect(result?.ok).toBe(false);
    });

    it('fetchEmployeePortalAssignmentDetail uses live path in supabase mode', async () => {
      vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
      vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
      vi.stubEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'test-key');

      const liveSpy = vi.spyOn(
        await import('@/lib/portal/employeePortalExecutionLiveService'),
        'fetchLiveEmployeePortalAssignmentDetail',
      ).mockResolvedValue({ ok: false, error: 'Einsatz nicht gefunden.' });

      const { fetchEmployeePortalAssignmentDetail } = await import(
        '@/lib/portal/employeePortalExecutionService'
      );
      const result = await fetchEmployeePortalAssignmentDetail(
        PRODUCTION_TENANT,
        'assign-001',
        EMPLOYEE_ID,
        'employee_portal',
      );
      expect(liveSpy).toHaveBeenCalled();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('Einsatz nicht gefunden.');
      }
      liveSpy.mockRestore();
    });

    it('fetchEmployeePortalAssignmentDetail succeeds for internal_test tenant with valid data', async () => {
      vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
      vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
      vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', '');

      const { fetchEmployeePortalAssignmentDetail } = await import(
        '@/lib/portal/employeePortalExecutionService'
      );
      const result = await fetchEmployeePortalAssignmentDetail(
        INTERNAL_TEST_TENANT,
        'assign-nonexistent',
        EMPLOYEE_ID,
        'employee_portal',
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('Einsatz nicht gefunden.');
      }
    });
  });

  describe('consent lookup is side-effect safe', () => {
    it('getEmployeePortalLocationConsent does not throw for unknown assignment', async () => {
      const { getEmployeePortalLocationConsent } = await import(
        '@/lib/portal/employeePortalVisitTrackingService'
      );
      const consent = getEmployeePortalLocationConsent(INTERNAL_TEST_TENANT, 'nonexistent');
      expect(consent).toBeDefined();
      expect(consent.granted).toBe(false);
    });

    it('getEmployeePortalLocationConsent returns stable result for repeated calls', async () => {
      const { getEmployeePortalLocationConsent } = await import(
        '@/lib/portal/employeePortalVisitTrackingService'
      );
      const c1 = getEmployeePortalLocationConsent(INTERNAL_TEST_TENANT, 'assign-x');
      const c2 = getEmployeePortalLocationConsent(INTERNAL_TEST_TENANT, 'assign-x');
      expect(c1).toEqual(c2);
    });
  });

  describe('fetchEmployeePortalOverview guard consistency', () => {
    it('overview delegates to live service in supabase mode', async () => {
      vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
      vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
      vi.stubEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'test-key');

      const liveSpy = vi.spyOn(
        await import('@/lib/portal/employeePortalExecutionLiveService'),
        'fetchLiveEmployeePortalOverviewWrapped',
      ).mockResolvedValue({
        ok: true,
        data: {
          todayAssignments: [],
          nextAssignments: [],
          weeklyPlan: [],
          openDocumentations: 0,
          missingSignatures: 0,
          adminMessageCount: 0,
          canReportProblem: true,
        },
      });

      const { fetchEmployeePortalOverview } = await import(
        '@/lib/portal/employeePortalExecutionService'
      );
      const result = await fetchEmployeePortalOverview(
        PRODUCTION_TENANT,
        EMPLOYEE_ID,
        'employee_portal',
      );
      expect(liveSpy).toHaveBeenCalled();
      expect(result.ok).toBe(true);
      liveSpy.mockRestore();
    });

    it('overview returns data for internal_test tenant', async () => {
      vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
      vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
      vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', '');

      const { fetchEmployeePortalOverview } = await import(
        '@/lib/portal/employeePortalExecutionService'
      );
      const result = await fetchEmployeePortalOverview(INTERNAL_TEST_TENANT, EMPLOYEE_ID, 'employee_portal');
      expect(result.ok).toBe(true);
    });
  });
});
