import { describe, expect, it, vi } from 'vitest';
import { deriveWorkflowStatus } from '@/features/assistWorkflow/deriveWorkflowStatus';
import { detectWorkflowInconsistencies } from '@/features/assistWorkflow/detectWorkflowInconsistencies';
import { resolveAllowedActions } from '@/features/assistWorkflow/resolveAllowedActions';
import { calculateVisitTimes } from '@/features/assistWorkflow/calculateVisitTimes';
import { startService } from '@/features/assistWorkflow/startService';
import type { AssistExecutionContext } from '@/features/assistWorkflow/types';

function mockCtx(overrides: Partial<AssistExecutionContext>): AssistExecutionContext {
  const visitTimes = {
    driveSeconds: 6180,
    serviceSeconds: null,
    pauseSeconds: null,
    totalSeconds: 6180,
    driveStartedAt: '2026-06-29T08:00:00Z',
    serviceStartedAt: null,
    pauseStartedAt: null,
    arrivedAt: '2026-06-29T09:43:00Z',
    serviceEndedAt: null,
    activeTimer: null,
  };
  const workflow = deriveWorkflowStatus('beendet', visitTimes);
  return {
    tenantId: 't1',
    assignmentId: '2a499c72-30f9-46bd-bfda-6a679ac85c73',
    employeeId: 'e1',
    profileId: 'p1',
    roleKey: 'employee',
    assistVisitId: 'v1',
    assignmentStatus: 'beendet',
    derivedStatus: workflow.derivedStatus,
    consistencyStatus: workflow.consistencyStatus,
    inconsistencies: workflow.inconsistencies,
    repairOptions: workflow.repairOptions,
    detail: {
      assignmentId: '2a499c72-30f9-46bd-bfda-6a679ac85c73',
      title: 'Heinz-Peter',
      clientName: 'Heinz-Peter Reinhardt',
      clientId: 'c1',
      locationAddress: 'Addr',
      plannedStartAt: '2026-06-29T08:00:00Z',
      plannedEndAt: '2026-06-29T10:00:00Z',
      status: 'beendet',
      requiresSignature: true,
      documentationStatus: 'pending',
      tasks: [],
      allowedTransitions: [],
      isLocked: false,
    },
    liveContext: null,
    visitTimes,
    timeEvents: [
      { eventType: 'drive_start', occurredAt: '2026-06-29T08:00:00Z' },
      { eventType: 'arrive', occurredAt: '2026-06-29T09:43:00Z' },
    ],
    allowedActions: [],
    diagnostics: {
      isServiceStarted: false,
      isServiceEnded: false,
      isTravelEnded: true,
      canEndService: false,
      inconsistentStatus: true,
      repairHint: workflow.nextActionHint,
    },
    ...overrides,
  };
}

describe('ASSIST.STABILIZE.1 Kevin visit scenario', () => {
  it('derives angekommen when beendet without service_start but arrived', () => {
    const visitTimes = calculateVisitTimes(
      [
        { eventType: 'drive_start', occurredAt: '2026-06-29T08:00:00Z' },
        { eventType: 'arrive', occurredAt: '2026-06-29T09:43:00Z' },
      ],
      'beendet',
    );
    const derived = deriveWorkflowStatus('beendet', visitTimes);
    expect(derived.derivedStatus).toBe('angekommen');
    expect(derived.consistencyStatus).toBe('repairable');
    expect(derived.canStartService).toBe(true);
    expect(derived.nextActionHint).toContain('Einsatz starten');
  });

  it('allows start_service but not end_service for Kevin-like state', () => {
    const visitTimes = calculateVisitTimes(
      [
        { eventType: 'drive_start', occurredAt: '2026-06-29T08:00:00Z' },
        { eventType: 'arrive', occurredAt: '2026-06-29T09:43:00Z' },
      ],
      'beendet',
    );
    const actions = resolveAllowedActions({
      assignmentStatus: 'beendet',
      visitTimes,
      detail: mockCtx({}).detail,
    });
    expect(actions).toContain('start_service');
    expect(actions).not.toContain('end_service');
  });

  it('detectWorkflowInconsistencies flags post_service_without_service_start', () => {
    const visitTimes = calculateVisitTimes(
      [{ eventType: 'arrive', occurredAt: '2026-06-29T09:43:00Z' }],
      'beendet',
    );
    const issues = detectWorkflowInconsistencies('beendet', visitTimes);
    expect(issues.some((i) => i.code === 'post_service_without_service_start')).toBe(true);
    expect(issues[0]?.repairable).toBe(true);
  });

  it('startService does not throw WORKFLOW_INVALID_STATE for repairable gestartet without service_start', async () => {
    vi.mock('@/lib/assist/assistTrackingPersistenceService', () => ({
      fetchTimeEventsForVisit: vi.fn().mockResolvedValue({
        ok: true,
        data: [
          { eventType: 'drive_start', occurredAt: '2026-06-29T08:00:00Z' },
          { eventType: 'arrive', occurredAt: '2026-06-29T09:43:00Z' },
        ],
      }),
    }));
    vi.mock('@/features/assistWorkflow/saveVisitTimeEvent', () => ({
      ensureVisitTimeEvent: vi.fn().mockResolvedValue({ ok: true, data: { id: 'x', created: true } }),
    }));
    vi.mock('@/features/assistWorkflow/resolveAssistExecutionContext', () => ({
      resolveAssistExecutionContext: vi.fn().mockResolvedValue({
        ok: true,
        data: mockCtx({ assignmentStatus: 'gestartet', derivedStatus: 'gestartet' }),
      }),
    }));

    const ctx = mockCtx({ assignmentStatus: 'gestartet', derivedStatus: 'angekommen' });
    const result = await startService(ctx);
    expect(result.ok).toBe(true);
  });
});

describe('deriveWorkflowStatus integration flow', () => {
  const events = [
    { eventType: 'drive_start', occurredAt: '2026-06-29T08:00:00Z' },
    { eventType: 'arrive', occurredAt: '2026-06-29T08:30:00Z' },
    { eventType: 'service_start', occurredAt: '2026-06-29T08:35:00Z' },
    { eventType: 'service_end', occurredAt: '2026-06-29T09:00:00Z' },
  ];

  it('consistent flow through service end', () => {
    const times = calculateVisitTimes(events, 'beendet');
    const derived = deriveWorkflowStatus('beendet', times);
    expect(derived.consistencyStatus).toBe('consistent');
    expect(derived.derivedStatus).toBe('beendet');
    const actions = resolveAllowedActions({
      assignmentStatus: 'beendet',
      visitTimes: times,
      detail: mockCtx({ status: 'beendet' } as never).detail,
    });
    expect(actions).not.toContain('start_service');
    expect(actions).not.toContain('end_service');
  });
});
