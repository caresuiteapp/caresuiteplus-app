import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { createAssignmentWorkflow } from '@/lib/assist/assignmentWorkflowService';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { isDemoMode } from '@/lib/supabase/config';
import { getGlobalEnvironmentMode } from '@/lib/environment';

describe('debug guard', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('logs guard state', () => {
    const block = guardServiceTenant(DEMO_TENANT_ID);
    const result = createAssignmentWorkflow(
      {
        tenantId: DEMO_TENANT_ID,
        clientId: 'client-001',
        employeeId: 'employee-001',
        serviceType: 'Alltagsbegleitung',
        plannedStartAt: '2026-07-01T09:00:00.000Z',
        plannedEndAt: '2026-07-01T11:00:00.000Z',
        locationAddress: 'Musterstraße 12, Berlin',
        title: 'Einsatz Test',
        tasks: [{ title: 'Begleitung Einkauf', description: 'Rewe' }],
      },
      'business_admin',
    );
    expect(result.ok, JSON.stringify(result)).toBe(true);
  });
});
