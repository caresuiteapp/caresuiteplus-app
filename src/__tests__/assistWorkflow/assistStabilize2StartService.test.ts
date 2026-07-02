import { describe, expect, it, vi, beforeEach } from 'vitest';
import { deriveWorkflowStatus } from '@/features/assistWorkflow/deriveWorkflowStatus';
import { calculateVisitTimes } from '@/features/assistWorkflow/calculateVisitTimes';
import { startService } from '@/features/assistWorkflow/startService';
import type { AssistExecutionContext } from '@/features/assistWorkflow/types';
import type { EmployeePortalAssignmentDetail } from '@/types/modules/employeePortalExecution';

const transitionMock = vi.fn();
const repairMock = vi.fn();
const resolveMock = vi.fn();
const fetchEventsMock = vi.fn();
const ensureEventMock = vi.fn();
const upsertStateMock = vi.fn();

vi.mock('@/features/assistWorkflow/internal/transitionAssistExecutionStatus', () => ({
  transitionAssistExecutionStatus: (...args: unknown[]) => transitionMock(...args),
}));

vi.mock('@/features/assistWorkflow/repairWorkflowState', () => ({
  repairWorkflowState: (...args: unknown[]) => repairMock(...args),
}));

vi.mock('@/features/assistWorkflow/resolveAssistExecutionContext', () => ({
  resolveAssistExecutionContext: (...args: unknown[]) => resolveMock(...args),
}));

vi.mock('@/lib/assist/assistTrackingPersistenceService', () => ({
  fetchTimeEventsForVisit: (...args: unknown[]) => fetchEventsMock(...args),
}));

vi.mock('@/features/assistWorkflow/saveVisitTimeEvent', () => ({
  ensureVisitTimeEvent: (...args: unknown[]) => ensureEventMock(...args),
}));

vi.mock('@/features/assistWorkflow/assistVisitExecutionStatePersistence', () => ({
  upsertAssistVisitExecutionState: (...args: unknown[]) => upsertStateMock(...args),
}));

function baseVisitTimes(overrides: Partial<ReturnType<typeof calculateVisitTimes>> = {}) {
  return {
    driveSeconds: 120,
    serviceSeconds: null,
    pauseSeconds: null,
    totalSeconds: 120,
    driveStartedAt: '2026-06-29T08:00:00Z',
    serviceStartedAt: null,
    pauseStartedAt: null,
    arrivedAt: '2026-06-29T08:30:00Z',
    serviceEndedAt: null,
    activeTimer: null,
    ...overrides,
  };
}

function successCtx(overrides: Partial<AssistExecutionContext>): AssistExecutionContext {
  const visitTimes = baseVisitTimes({
    serviceStartedAt: '2026-06-29T08:35:00Z',
    serviceSeconds: 300,
    activeTimer: 'service',
  });
  const workflow = deriveWorkflowStatus('gestartet', visitTimes);
  return {
    tenantId: '56180c22-b894-4fab-b55e-a563c94dd6e7',
    assignmentId: '3a24ee90-5dd3-4ab5-9f02-ae74060e0a8a',
    employeeId: 'e036ecd3-8ff7-4453-af93-ebbcbd0820f2',
    profileId: 'p1',
    roleKey: 'employee_portal',
    assistVisitId: '3a24ee90-5dd3-4ab5-9f02-ae74060e0a8a',
    assignmentStatus: 'gestartet',
    derivedStatus: workflow.derivedStatus,
    consistencyStatus: workflow.consistencyStatus,
    inconsistencies: workflow.inconsistencies,
    repairOptions: workflow.repairOptions,
    detail: {
      assignmentId: '3a24ee90-5dd3-4ab5-9f02-ae74060e0a8a',
      title: 'Kevin Visit',
      clientName: 'Test',
      clientId: 'c1',
      locationAddress: 'Addr',
      plannedStartAt: '2026-06-29T08:00:00Z',
      plannedEndAt: '2026-06-29T10:00:00Z',
      status: 'gestartet',
      requiresSignature: false,
      documentationStatus: 'none',
      tasks: [],
      allowedTransitions: [],
      isLocked: false,
    } as unknown as EmployeePortalAssignmentDetail,
    liveContext: null,
    visitTimes,
    timeEvents: [
      { eventType: 'drive_start', occurredAt: '2026-06-29T08:00:00Z' },
      { eventType: 'arrive', occurredAt: '2026-06-29T08:30:00Z' },
      { eventType: 'service_start', occurredAt: '2026-06-29T08:35:00Z' },
    ],
    allowedActions: ['end_service', 'start_pause', 'open_route'],
    diagnostics: {
      isServiceStarted: true,
      isServiceEnded: false,
      isTravelEnded: true,
      canEndService: true,
      inconsistentStatus: false,
      repairHint: null,
    },
    ...overrides,
  };
}

function mockCtx(overrides: Partial<AssistExecutionContext>): AssistExecutionContext {
  const visitTimes = baseVisitTimes();
  const workflow = deriveWorkflowStatus(
    overrides.assignmentStatus ?? 'gestartet',
    overrides.visitTimes ?? visitTimes,
  );
  return successCtx({
    assignmentStatus: 'gestartet',
    derivedStatus: workflow.derivedStatus,
    consistencyStatus: workflow.consistencyStatus,
    visitTimes,
    allowedActions: [],
    diagnostics: {
      isServiceStarted: false,
      isServiceEnded: false,
      isTravelEnded: true,
      canEndService: false,
      inconsistentStatus: workflow.consistencyStatus !== 'consistent',
      repairHint: workflow.nextActionHint,
    },
    ...overrides,
  });
}

describe('ASSIST.STABILIZE.2 startService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchEventsMock.mockResolvedValue({
      ok: true,
      data: [
        { eventType: 'drive_start', occurredAt: '2026-06-29T08:00:00Z' },
        { eventType: 'arrive', occurredAt: '2026-06-29T08:30:00Z' },
      ],
    });
    ensureEventMock.mockResolvedValue({ ok: true, data: { id: 'evt1', created: true } });
    upsertStateMock.mockResolvedValue({ ok: true, data: { visitId: 'v1', currentStep: 'in_service' } });
  });

  it('success: angekommen → transition + readback verified', async () => {
    const started = successCtx({ assignmentStatus: 'gestartet', derivedStatus: 'gestartet' });
    transitionMock.mockResolvedValue({ ok: true, data: started });
    resolveMock.mockResolvedValue({ ok: true, data: started });

    const ctx = mockCtx({ assignmentStatus: 'angekommen', derivedStatus: 'angekommen' });
    const result = await startService(ctx);

    expect(result.ok).toBe(true);
    expect(transitionMock).toHaveBeenCalled();
    expect(upsertStateMock).toHaveBeenCalled();
    expect(resolveMock).toHaveBeenCalled();
  });

  it('idempotent: already has serviceStartedAt returns refreshed context', async () => {
    const ctx = successCtx({});
    resolveMock.mockResolvedValue({ ok: true, data: ctx });

    const result = await startService(ctx);
    expect(result.ok).toBe(true);
    expect(transitionMock).not.toHaveBeenCalled();
    expect(ensureEventMock).not.toHaveBeenCalled();
  });

  it('backfill: gestartet without service_start inserts event and verifies readback', async () => {
    const afterBackfill = successCtx({});
    fetchEventsMock.mockResolvedValue({
      ok: true,
      data: [
        { eventType: 'drive_start', occurredAt: '2026-06-29T08:00:00Z' },
        { eventType: 'arrive', occurredAt: '2026-06-29T08:30:00Z' },
      ],
    });
    ensureEventMock.mockResolvedValue({ ok: true, data: { id: 'evt1', created: true } });
    resolveMock.mockResolvedValue({ ok: true, data: afterBackfill });

    const ctx = mockCtx({ assignmentStatus: 'gestartet', derivedStatus: 'angekommen' });
    const result = await startService(ctx);

    expect(result.ok).toBe(true);
    expect(ensureEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'service_start' }),
      expect.any(Array),
    );
    expect(transitionMock).not.toHaveBeenCalled();
  });

  it('blocked: missing arrival returns START_SERVICE_INVALID_TRANSITION', async () => {
    const ctx = mockCtx({
      assignmentStatus: 'unterwegs',
      derivedStatus: 'unterwegs',
      visitTimes: baseVisitTimes({ arrivedAt: null }),
    });

    const result = await startService(ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect((result as { errorCode?: string }).errorCode).toBe('START_SERVICE_INVALID_TRANSITION');
    }
  });

  it('repair path: repairable beendet resets once then starts', async () => {
    const repairedCtx = mockCtx({ assignmentStatus: 'angekommen', derivedStatus: 'angekommen' });
    const started = successCtx({ assignmentStatus: 'gestartet', derivedStatus: 'gestartet' });

    repairMock.mockResolvedValueOnce({
      ok: true,
      data: { repaired: true, ctx: repairedCtx, appliedRepairs: ['status→angekommen'] },
    });
    transitionMock.mockResolvedValue({ ok: true, data: started });
    resolveMock.mockResolvedValue({ ok: true, data: started });

    const ctx = mockCtx({
      assignmentStatus: 'beendet',
      derivedStatus: 'angekommen',
      consistencyStatus: 'repairable',
    });

    const result = await startService(ctx);
    expect(result.ok).toBe(true);
    expect(repairMock).toHaveBeenCalledTimes(1);
  });

  it('readback failure: missing service_started_at after write', async () => {
    fetchEventsMock.mockResolvedValue({ ok: true, data: [] });
    ensureEventMock.mockResolvedValue({ ok: true, data: { id: 'evt1', created: true } });
    resolveMock.mockResolvedValue({
      ok: true,
      data: mockCtx({ assignmentStatus: 'gestartet', derivedStatus: 'angekommen' }),
    });

    const ctx = mockCtx({ assignmentStatus: 'gestartet', derivedStatus: 'angekommen' });
    const result = await startService(ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect((result as { errorCode?: string }).errorCode).toBe('START_SERVICE_DB_ERROR');
    }
  });

  it('RLS denied on time event maps to START_SERVICE_RLS_DENIED', async () => {
    fetchEventsMock.mockResolvedValue({ ok: true, data: [] });
    ensureEventMock.mockResolvedValue({
      ok: false,
      error: 'Kein Zugriff',
      errorCode: 'AWF_RLS_DENIED',
    });

    const ctx = mockCtx({ assignmentStatus: 'gestartet', derivedStatus: 'angekommen' });
    const result = await startService(ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect((result as { errorCode?: string }).errorCode).toBe('START_SERVICE_RLS_DENIED');
    }
  });

  it('allowedActions after success include end_service and start_pause', async () => {
    const started = successCtx({});
    transitionMock.mockResolvedValue({ ok: true, data: started });
    resolveMock.mockResolvedValue({ ok: true, data: started });

    const ctx = mockCtx({ assignmentStatus: 'angekommen', derivedStatus: 'angekommen' });
    const result = await startService(ctx);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.allowedActions).toContain('end_service');
      expect(result.data.allowedActions).toContain('start_pause');
      expect(result.data.diagnostics.canEndService).toBe(true);
    }
  });
});

describe('ASSIST.STABILIZE.2 withWorkflowTimeout', () => {
  it('rejects after timeout', async () => {
    const { withWorkflowTimeout, WorkflowActionTimeoutError } = await import(
      '@/features/assistWorkflow/internal/withWorkflowTimeout'
    );
    await expect(
      withWorkflowTimeout(new Promise(() => {}), 20, 'test'),
    ).rejects.toBeInstanceOf(WorkflowActionTimeoutError);
  });
});
