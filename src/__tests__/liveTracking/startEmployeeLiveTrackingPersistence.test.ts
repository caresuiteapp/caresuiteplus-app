import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  appendLocationPoint: vi.fn(),
  fetchActiveTrackingSession: vi.fn(),
  fetchTimeEventsForVisit: vi.fn(),
  recordTimeEvent: vi.fn(),
  startTrackingSession: vi.fn(),
  resolveEmployeeLiveContext: vi.fn(),
  syncAssistTimeEventToWfm: vi.fn(),
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
  syncAssistTimeEventToWfm: mocks.syncAssistTimeEventToWfm,
}));

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => null,
}));

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
    mocks.syncAssistTimeEventToWfm.mockResolvedValue({ ok: true, data: undefined });
    mocks.appendLocationPoint.mockResolvedValue({ ok: true, data: { id: 'location-1' } });
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
    expect(mocks.syncAssistTimeEventToWfm).toHaveBeenCalledWith(
      'tenant-1',
      'employee-1',
      null,
      'visit-1',
      'drive_start',
      '2026-08-02T08:00:00.000Z',
    );
  });

  it('fails visibly when WFM cannot confirm the drive event', async () => {
    mocks.syncAssistTimeEventToWfm.mockResolvedValue({
      ok: false,
      error: 'WFM nicht erreichbar',
    });
    mocks.recordTimeEvent.mockResolvedValue({ ok: true, data: { id: 'event-1' } });

    const result = await startEmployeeLiveTracking({
      tenantId: 'tenant-1',
      employeeId: 'employee-1',
      routeParamId: 'assignment-1',
      withoutGps: true,
      transitionToEnRoute: false,
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error).toContain('Zeiterfassung');
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
