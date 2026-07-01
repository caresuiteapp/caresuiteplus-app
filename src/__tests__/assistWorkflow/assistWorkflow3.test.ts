import { describe, expect, it } from 'vitest';
import {
  resolveAllowedActions,
  resolveAssistExecutionDiagnostics,
  primaryAllowedAction,
} from '@/features/assistWorkflow/resolveAllowedActions';
import { calculateVisitTimes } from '@/features/assistWorkflow/calculateVisitTimes';
import type { AssistExecutionContext } from '@/features/assistWorkflow/types';
import {
  buildTimeEventsFromVisitTimesSummary,
  computeLiveVisitTimers,
} from '@/features/assistWorkflow/computeLiveVisitTimers';

function baseDetail(): AssistExecutionContext['detail'] {
  return {
    assignmentId: 'a1',
    title: 'Test',
    clientName: 'Client',
    clientId: 'c1',
    locationAddress: 'Addr',
    plannedStartAt: '2026-06-29T08:00:00Z',
    plannedEndAt: '2026-06-29T10:00:00Z',
    status: 'gestartet',
    requiresSignature: true,
    documentationStatus: 'pending',
    tasks: [],
    allowedTransitions: ['nicht_erschienen'],
    isLocked: false,
  };
}

describe('resolveAllowedActions (ASSIST.WORKFLOW.3)', () => {
  it('omits end_service without service_start (effective angekommen)', () => {
    const visitTimes = calculateVisitTimes(
      [
        { eventType: 'drive_start', occurredAt: '2026-06-29T08:00:00Z' },
        { eventType: 'arrive', occurredAt: '2026-06-29T08:30:00Z' },
      ],
      'gestartet',
    );
    const actions = resolveAllowedActions({
      assignmentStatus: 'gestartet',
      visitTimes,
      detail: baseDetail(),
    });
    expect(actions).not.toContain('end_service');
    expect(actions).toContain('start_service');
  });

  it('allows end_service when service started', () => {
    const visitTimes = calculateVisitTimes(
      [
        { eventType: 'arrive', occurredAt: '2026-06-29T08:30:00Z' },
        { eventType: 'service_start', occurredAt: '2026-06-29T08:35:00Z' },
      ],
      'gestartet',
    );
    const actions = resolveAllowedActions({
      assignmentStatus: 'gestartet',
      visitTimes,
      detail: baseDetail(),
    });
    expect(actions).toContain('end_service');
    expect(primaryAllowedAction(actions, 'gestartet')).toBe('end_service');
  });
});

describe('resolveAssistExecutionDiagnostics (ASSIST.WORKFLOW.3)', () => {
  it('canEndService only with start and without end', () => {
    const visitTimes = {
      driveSeconds: 100,
      serviceSeconds: 10,
      pauseSeconds: null,
      totalSeconds: 110,
      driveStartedAt: '2026-06-29T08:00:00Z',
      serviceStartedAt: '2026-06-29T09:00:00Z',
      pauseStartedAt: null,
      arrivedAt: '2026-06-29T08:30:00Z',
      serviceEndedAt: null,
      activeTimer: 'service' as const,
    };
    const started = resolveAssistExecutionDiagnostics('gestartet', visitTimes);
    expect(started.canEndService).toBe(true);

    const ended = resolveAssistExecutionDiagnostics('beendet', {
      ...visitTimes,
      serviceEndedAt: '2026-06-29T10:00:00Z',
      activeTimer: null,
    });
    expect(ended.canEndService).toBe(false);
  });
});

describe('useLiveVisitTimers (ASSIST.WORKFLOW.3)', () => {
  it('module exports hook for live timer tick', async () => {
    const mod = await import('@/features/assistWorkflow/computeLiveVisitTimers');
    expect(mod.computeLiveVisitTimers).toBeTypeOf('function');
  });

  it('continues service timer from fallback anchors when time events are stale', () => {
    const startedAt = '2026-06-29T08:00:00.000Z';
    const fallbackTimes = {
      driveSeconds: 600,
      serviceSeconds: 120,
      pauseSeconds: null,
      totalSeconds: 720,
      driveStartedAt: '2026-06-29T07:50:00.000Z',
      serviceStartedAt: startedAt,
      pauseStartedAt: null,
      arrivedAt: '2026-06-29T07:59:00.000Z',
      serviceEndedAt: null,
      activeTimer: 'service' as const,
    };

    const t0 = computeLiveVisitTimers([], 'gestartet', fallbackTimes, new Date('2026-06-29T08:02:00.000Z'));
    const t1 = computeLiveVisitTimers([], 'gestartet', fallbackTimes, new Date('2026-06-29T08:02:05.000Z'));

    expect(t0?.serviceSeconds).toBe(120);
    expect(t1?.serviceSeconds).toBe(125);
    expect(t1?.activeTimer).toBe('service');
  });

  it('uses local store fallback when server events and visitTimes are unavailable', () => {
    const driveStartedAt = '2026-06-29T08:00:00.000Z';
    const localTimers = (now: Date) => ({
      driveSeconds: Math.max(
        0,
        Math.round((now.getTime() - new Date(driveStartedAt).getTime()) / 1000),
      ),
      serviceSeconds: null,
      pauseSeconds: null,
      activeTimer: 'drive' as const,
      driveStartedAt,
      serviceStartedAt: null,
      pauseStartedAt: null,
    });

    const first = computeLiveVisitTimers([], 'unterwegs', null, new Date('2026-06-29T08:00:30.000Z'), true, localTimers);
    const second = computeLiveVisitTimers([], 'unterwegs', null, new Date('2026-06-29T08:00:40.000Z'), true, localTimers);

    expect(first?.driveSeconds).toBe(30);
    expect(second?.driveSeconds).toBe(40);
    expect(buildTimeEventsFromVisitTimesSummary({
      driveSeconds: 10,
      serviceSeconds: null,
      pauseSeconds: null,
      totalSeconds: 10,
      driveStartedAt: '2026-06-29T08:00:00.000Z',
      serviceStartedAt: null,
      pauseStartedAt: null,
      arrivedAt: null,
      serviceEndedAt: null,
      activeTimer: 'drive',
    })).toEqual([{ eventType: 'drive_start', occurredAt: '2026-06-29T08:00:00.000Z' }]);
  });

  it('keeps ticking from time events without network-derived refresh', () => {
    const events = [
      { eventType: 'service_start', occurredAt: '2026-06-29T08:00:00.000Z' },
    ];
    const atTwoMinutes = computeLiveVisitTimers(events, 'gestartet', null, new Date('2026-06-29T08:02:00.000Z'));
    const atThreeMinutes = computeLiveVisitTimers(events, 'gestartet', null, new Date('2026-06-29T08:03:00.000Z'));

    expect(atTwoMinutes?.serviceSeconds).toBe(120);
    expect(atThreeMinutes?.serviceSeconds).toBe(180);
  });
});
