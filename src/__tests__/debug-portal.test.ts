import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { createAssignmentWorkflow } from '@/lib/assist/assignmentWorkflowService';

describe('debug portal assignment', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('creates assignment for employee-003', () => {
    const result = createAssignmentWorkflow(
      {
        tenantId: DEMO_TENANT_ID,
        clientId: 'client-001',
        employeeId: 'employee-003',
        serviceType: 'Alltagsbegleitung',
        plannedStartAt: '2026-07-01T09:00:00.000Z',
        plannedEndAt: '2026-07-01T11:00:00.000Z',
        locationAddress: 'Musterstraße 12, Berlin',
        title: 'Einsatz Portal-Test',
        tasks: [{ title: 'Begleitung' }],
      },
      'business_admin',
    );
    expect(result.ok, JSON.stringify(result)).toBe(true);
  });
});
