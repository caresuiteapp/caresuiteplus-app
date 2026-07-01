import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { resetWfmDemoStore, listSessionsForDate, workDateFromIso } from '@/lib/wfm';
import { resetWfmAssistAdapterState } from '@/lib/wfm/wfmAssistAdapter';
import { saveVisitTimeEvent } from '@/features/assistWorkflow/saveVisitTimeEvent';

const TENANT = DEMO_TENANT_ID;
const VISIT = 'visit-wfm-sync-1';
const EMPLOYEE = 'employee-wfm-sync';
const PROFILE = 'profile-wfm-sync';

vi.mock('@/lib/assist/assistTrackingPersistenceService', () => ({
  recordTimeEvent: vi.fn(async () => ({ ok: true as const, data: { id: 'evt-1' } })),
  fetchTimeEventsForVisit: vi.fn(async () => ({
    ok: true as const,
    data: [
      { eventType: 'service_start', occurredAt: '2026-07-01T08:00:00.000Z' },
      { eventType: 'service_end', occurredAt: '2026-07-01T09:30:00.000Z' },
    ],
  })),
}));

beforeEach(() => {
  vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
  resetWfmDemoStore();
  resetWfmAssistAdapterState();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('saveVisitTimeEvent → WFM sync', () => {
  it('creates workforce session when service_end is saved', async () => {
    await saveVisitTimeEvent({
      tenantId: TENANT,
      visitId: VISIT,
      eventType: 'service_start',
      occurredAt: '2026-07-01T08:00:00.000Z',
      employeeId: EMPLOYEE,
      profileId: PROFILE,
    });

    const endResult = await saveVisitTimeEvent({
      tenantId: TENANT,
      visitId: VISIT,
      eventType: 'service_end',
      occurredAt: '2026-07-01T09:30:00.000Z',
      employeeId: EMPLOYEE,
      profileId: PROFILE,
    });

    expect(endResult.ok).toBe(true);

    const workDate = workDateFromIso('2026-07-01T09:30:00.000Z');
    const team = await listSessionsForDate(TENANT, workDate);
    expect(team.ok).toBe(true);
    if (!team.ok) return;

    const session = team.data.find((s) => s.employeeId === EMPLOYEE);
    expect(session).toBeTruthy();
    expect(session?.netMinutes).toBeGreaterThan(0);
  });
});
