import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import {
  listWfmAbsencesForEmployee,
  requestWfmAbsence,
  resetWfmAbsenceDemoStore,
} from '@/lib/wfm/wfmAbsenceService';
import { resetWfmApprovalDemoStore } from '@/lib/wfm/wfmApprovalService';

const TENANT = DEMO_TENANT_ID;
const USER = 'user-absence-test';
const ROLE = 'employee_portal' as const;

beforeEach(() => {
  vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
  resetWfmAbsenceDemoStore();
  resetWfmApprovalDemoStore();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('wfmAbsenceService', () => {
  it('stellt Urlaubsantrag und listet ihn', async () => {
    const created = await requestWfmAbsence(TENANT, USER, ROLE, {
      absenceType: 'vacation',
      startsAt: '2026-07-01T00:00:00.000Z',
      endsAt: '2026-07-05T23:59:59.000Z',
      employeeNote: 'Sommerurlaub',
    });
    expect(created.ok).toBe(true);

    const list = await listWfmAbsencesForEmployee(TENANT, USER, ROLE);
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.data.length).toBe(1);
    expect(list.data[0]?.status).toBe('requested');
  });
});
