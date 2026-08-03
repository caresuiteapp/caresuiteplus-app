import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  appendLocationPoint: vi.fn(),
  fetchActiveTrackingSession: vi.fn(),
  fetchTimeEventsForVisit: vi.fn(),
  recordTimeEvent: vi.fn(),
  startTrackingSession: vi.fn(),
  resolveEmployeeLiveContext: vi.fn(),
  syncAssistTimeEventToWfmPortalSafe: vi.fn(),
  mirrorAssistVisitStatusFromAssignment: vi.fn(),
  supabaseRpc: vi.fn(),
}));

vi.mock('@/lib/assist/assistTrackingPersistenceService', () => ({
  appendLocationPoint: mocks.appendLocationPoint,
  fetchActiveTrackingSession: mocks.fetchActiveTrackingSession,
  fetchTimeEventsForVisit: mocks.fetchTimeEventsForVisit,
  recordTimeEvent: mocks.recordTimeEvent,
  startTrackingSession: mocks.startTrackingSession,
}));

vi.mock('@/features/liveTracking/resolveEmployeeLiveContext', () => ({
  resolveEmployeeLiveContext: mocks.resolveEmployeeLiveContext,
}));

vi.mock('@/lib/wfm/wfmAssistAdapter', () => ({
  syncAssistTimeEventToWfmPortalSafe: mocks.syncAssistTimeEventToWfmPortalSafe,
}));

vi.mock('@/lib/portal/employeePortalExecutionLiveService', () => ({
  mirrorAssistVisitStatusFromAssignment: mocks.mirrorAssistVisitStatusFromAssignment,
}));

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => ({ rpc: mocks.supabaseRpc }),
}));

// eslint-disable-next-line import/first -- module must load after hoisted dependency mocks
import { startEmployeeLiveTracking } from '@/features/liveTracking/startEmployeeLiveTracking';

const liveContext = {
  tenantId: 'tenant-1',
  employeeId: 'employee-1',
  assignmentId: 'assignment-1',
  assistVisitId: 'visit-1',
  assignmentStatus: 'geplant',
  trackingSessionId: 'session-1',
  trackingSessionActive: true,
};

describe('startEmployeeLiveTracking critical persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveEmployeeLiveContext.mockResolvedValue({ ok: true, data: liveContext });
    mocks.fetchTimeEventsForVisit.mockResolvedValue({ ok: true, data: [] });
    mocks.syncAssistTimeEventToWfmPortalSafe.mockResolvedValue({ ok: true, data: undefined });
    mocks.appendLocationPoint.mockResolvedValue({ ok: true, data: { id: 'location-1' } });
    mocks.mirrorAssistVisitStatusFromAssignment.mockResolvedValue({
      ok: true,
      data: undefined,
    });
    mocks.supabaseRpc.mockResolvedValue({ data: null, error: null });
  });

  it('repairs a partial drive start and continues through status + live mirror', async () => {
    mocks.fetchTimeEventsForVisit.mockResolvedValue({
      ok: true,
      data: [
        {
          id: 'event-partial',
          eventType: 'drive_start',
          occurredAt: '2026-08-03T00:19:00.000Z',
        },
      ],
    });

    const result = await startEmployeeLiveTracking({
      tenantId: 'tenant-1',
      employeeId: 'employee-1',
      routeParamId: 'assignment-1',
      withoutGps: true,
    });

    expect(result.ok).toBe(true);
    expect(mocks.recordTimeEvent).not.toHaveBeenCalled();
    expect(mocks.syncAssistTimeEventToWfmPortalSafe).toHaveBeenCalledWith(
      'tenant-1',
      'employee-1',
      null,
      'visit-1',
      'drive_start',
      '2026-08-03T00:19:00.000Z',
    );
    expect(mocks.supabaseRpc).toHaveBeenCalledWith(
      'set_assignment_status',
      expect.objectContaining({
        input_assignment_id: 'assignment-1',
        input_employee_id: 'employee-1',
      }),
    );
    expect(mocks.mirrorAssistVisitStatusFromAssignment).toHaveBeenCalledWith(
      'tenant-1',
      'assignment-1',
      'unterwegs',
      null,
    );
    expect(mocks.resolveEmployeeLiveContext).toHaveBeenCalledTimes(1);
  });

  it('reuses an open drive event without writing a duplicate and re-confirms WFM', async () => {
    mocks.fetchTimeEventsForVisit.mockResolvedValue({
      ok: true,
      data: [
        {
          id: 'event-1',
          eventType: 'drive_start',
          occurredAt: '2026-08-02T08:00:00.000Z',
        },
      ],
    });

    const result = await startEmployeeLiveTracking({
      tenantId: 'tenant-1',
      employeeId: 'employee-1',
      routeParamId: 'assignment-1',
      withoutGps: true,
      transitionToEnRoute: false,
    });

    expect(result.ok).toBe(true);
    expect(mocks.recordTimeEvent).not.toHaveBeenCalled();
    expect(mocks.syncAssistTimeEventToWfmPortalSafe).toHaveBeenCalledWith(
      'tenant-1',
      'employee-1',
      null,
      'visit-1',
      'drive_start',
      '2026-08-02T08:00:00.000Z',
    );
  });

  it('does not block the canonical drive start while WFM is unavailable', async () => {
    mocks.syncAssistTimeEventToWfmPortalSafe.mockImplementation(() => new Promise(() => {}));
    mocks.recordTimeEvent.mockResolvedValue({ ok: true, data: { id: 'event-1' } });

    const result = await Promise.race([
      startEmployeeLiveTracking({
        tenantId: 'tenant-1',
        employeeId: 'employee-1',
        routeParamId: 'assignment-1',
        withoutGps: true,
        transitionToEnRoute: false,
      }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('blocked by WFM')), 100)),
    ]);

    expect(result.ok).toBe(true);
    expect(mocks.recordTimeEvent).toHaveBeenCalledTimes(1);
    expect(mocks.syncAssistTimeEventToWfmPortalSafe).toHaveBeenCalledTimes(1);
  });

  it('does not create a second session when active-session readback fails', async () => {
    mocks.resolveEmployeeLiveContext.mockResolvedValueOnce({
      ok: true,
      data: {
        ...liveContext,
        trackingSessionId: null,
        trackingSessionActive: false,
      },
    });
    mocks.fetchActiveTrackingSession.mockResolvedValue({
      ok: false,
      error: 'Tracking-Sitzung konnte nicht gelesen werden.',
    });

    const result = await startEmployeeLiveTracking({
      tenantId: 'tenant-1',
      employeeId: 'employee-1',
      routeParamId: 'assignment-1',
      withoutGps: true,
      transitionToEnRoute: false,
    });

    expect(result.ok).toBe(false);
    expect(mocks.startTrackingSession).not.toHaveBeenCalled();
  });
});
