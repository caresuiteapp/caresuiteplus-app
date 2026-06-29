import { describe, expect, it } from 'vitest';
import {
  resolveAllowedActions,
  resolveAssistExecutionDiagnostics,
  primaryAllowedAction,
} from '@/features/assistWorkflow/resolveAllowedActions';
import { calculateVisitTimes } from '@/features/assistWorkflow/calculateVisitTimes';
import type { AssistExecutionContext } from '@/features/assistWorkflow/types';

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
    const mod = await import('@/hooks/useLiveVisitTimers');
    expect(mod.useLiveVisitTimers).toBeTypeOf('function');
  });
});
