import { describe, expect, it, vi, beforeEach } from 'vitest';
import { calculateVisitTimes } from '@/features/assistWorkflow/calculateVisitTimes';
import { resolveAllowedActions } from '@/features/assistWorkflow/resolveAllowedActions';
import { deriveWorkflowStatus } from '@/features/assistWorkflow/deriveWorkflowStatus';
import { hasOpenPauseSegment } from '@/features/assistWorkflow/saveVisitTimeEvent';
import { startPause } from '@/features/assistWorkflow/startPause';
import { endPause } from '@/features/assistWorkflow/endPause';
import { endService } from '@/features/assistWorkflow/endService';
import type { AssistExecutionContext } from '@/features/assistWorkflow/types';
import type { EmployeePortalAssignmentDetail } from '@/types/modules/employeePortalExecution';

const transitionMock = vi.fn();
const resolveMock = vi.fn();
const fetchEventsMock = vi.fn();
const ensureOpenPauseStartMock = vi.fn();
const ensureOpenPauseEndMock = vi.fn();
const ensureVisitTimeEventMock = vi.fn();
const upsertStateMock = vi.fn();
const markAssignmentExecutedMock = vi.fn();

vi.mock('@/features/assistWorkflow/internal/transitionAssistExecutionStatus', () => ({
  transitionAssistExecutionStatus: (...args: unknown[]) => transitionMock(...args),
}));

vi.mock('@/features/assistWorkflow/resolveAssistExecutionContext', () => ({
  resolveAssistExecutionContext: (...args: unknown[]) => resolveMock(...args),
}));

vi.mock('@/lib/assist/assistTrackingPersistenceService', () => ({
  fetchTimeEventsForVisit: (...args: unknown[]) => fetchEventsMock(...args),
}));

vi.mock('@/features/assistWorkflow/saveVisitTimeEvent', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/assistWorkflow/saveVisitTimeEvent')>();
  return {
    ...actual,
    ensureOpenPauseStartEvent: (...args: unknown[]) => ensureOpenPauseStartMock(...args),
    ensureOpenPauseEndEvent: (...args: unknown[]) => ensureOpenPauseEndMock(...args),
    ensureVisitTimeEvent: (...args: unknown[]) => ensureVisitTimeEventMock(...args),
  };
});

vi.mock('@/features/assistWorkflow/assistVisitExecutionStatePersistence', () => ({
  upsertAssistVisitExecutionState: (...args: unknown[]) => upsertStateMock(...args),
}));

vi.mock('@/lib/assist/clientBudgetTransactionService', () => ({
  markAssignmentExecuted: (...args: unknown[]) => markAssignmentExecutedMock(...args),
}));

vi.mock('@/lib/services/mode', () => ({
  getServiceMode: () => 'supabase',
}));

function baseDetail(status: AssistExecutionContext['assignmentStatus']): EmployeePortalAssignmentDetail {
  return {
    assignmentId: '3a24ee90-5dd3-4ab5-9f02-ae74060e0a8a',
    title: 'Kevin Visit',
    clientName: 'Test',
    clientId: 'c1',
    locationAddress: 'Addr',
    plannedStartAt: '2026-06-29T08:00:00Z',
    plannedEndAt: '2026-06-29T10:00:00Z',
    status,
    requiresSignature: false,
    documentationStatus: 'none',
    tasks: [],
    allowedTransitions: [],
    isLocked: false,
  } as unknown as EmployeePortalAssignmentDetail;
}

function ctx(overrides: Partial<AssistExecutionContext>): AssistExecutionContext {
  const visitTimes = calculateVisitTimes(
    overrides.timeEvents ?? [
      { eventType: 'drive_start', occurredAt: '2026-06-29T08:00:00Z' },
      { eventType: 'arrive', occurredAt: '2026-06-29T08:30:00Z' },
      { eventType: 'service_start', occurredAt: '2026-06-29T08:35:00Z' },
    ],
    overrides.assignmentStatus ?? 'gestartet',
  );
  const workflow = deriveWorkflowStatus(overrides.assignmentStatus ?? 'gestartet', visitTimes);
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
    detail: baseDetail('gestartet'),
    liveContext: null,
    visitTimes,
    timeEvents: [
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

describe('ASSIST.STABILIZE.3 calculateVisitTimes', () => {
  it('freezes service seconds during active pause', () => {
    const t1 = calculateVisitTimes(
      [
        { eventType: 'service_start', occurredAt: '2026-06-29T09:00:00.000Z' },
        { eventType: 'pause_start', occurredAt: '2026-06-29T09:20:00.000Z' },
      ],
      'pausiert',
      new Date('2026-06-29T09:30:00.000Z'),
    );
    const t2 = calculateVisitTimes(
      [
        { eventType: 'service_start', occurredAt: '2026-06-29T09:00:00.000Z' },
        { eventType: 'pause_start', occurredAt: '2026-06-29T09:20:00.000Z' },
      ],
      'pausiert',
      new Date('2026-06-29T09:45:00.000Z'),
    );
    expect(t1.serviceSeconds).toBe(1200);
    expect(t2.serviceSeconds).toBe(1200);
    expect(t2.pauseSeconds).toBeGreaterThan(t1.pauseSeconds ?? 0);
    expect(t1.activeTimer).toBe('pause');
  });

  it('preserves service seconds after service_end', () => {
    const times = calculateVisitTimes(
      [
        { eventType: 'service_start', occurredAt: '2026-06-29T09:00:00.000Z' },
        { eventType: 'service_end', occurredAt: '2026-06-29T10:00:00.000Z' },
      ],
      'beendet',
    );
    expect(times.serviceSeconds).toBe(3600);
    expect(times.serviceEndedAt).toBe('2026-06-29T10:00:00.000Z');
    expect(times.activeTimer).toBeNull();
  });

  it('derives beendet when service_end exists even if recorded status is gestartet', () => {
    const visitTimes = calculateVisitTimes(
      [
        { eventType: 'service_start', occurredAt: '2026-06-29T09:00:00.000Z' },
        { eventType: 'service_end', occurredAt: '2026-06-29T10:00:00.000Z' },
      ],
      'gestartet',
    );
    const workflow = deriveWorkflowStatus('gestartet', visitTimes);
    expect(workflow.derivedStatus).toBe('beendet');
    expect(workflow.canStartService).toBe(false);
  });
});

describe('ASSIST.STABILIZE.3 resolveAllowedActions', () => {
  it('offers end_service while paused', () => {
    const visitTimes = calculateVisitTimes(
      [
        { eventType: 'service_start', occurredAt: '2026-06-29T09:00:00.000Z' },
        { eventType: 'pause_start', occurredAt: '2026-06-29T09:20:00.000Z' },
      ],
      'pausiert',
    );
    const actions = resolveAllowedActions({
      assignmentStatus: 'pausiert',
      visitTimes,
      detail: baseDetail('pausiert'),
      derivedStatus: 'pausiert',
    });
    expect(actions).toContain('end_pause');
    expect(actions).toContain('end_service');
  });
});

describe('ASSIST.STABILIZE.3 hasOpenPauseSegment', () => {
  it('detects open pause', () => {
    expect(
      hasOpenPauseSegment([
        { eventType: 'pause_start' },
        { eventType: 'pause_end' },
        { eventType: 'pause_start' },
      ]),
    ).toBe(true);
    expect(
      hasOpenPauseSegment([
        { eventType: 'pause_start' },
        { eventType: 'pause_end' },
      ]),
    ).toBe(false);
  });
});

describe('ASSIST.STABILIZE.3 startPause', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchEventsMock.mockResolvedValue({ ok: true, data: [] });
    ensureOpenPauseStartMock.mockResolvedValue({ ok: true, data: { id: 'p1', created: true } });
    upsertStateMock.mockResolvedValue({ ok: true, data: { visitId: 'v1', currentStep: 'paused' } });
  });

  it('transitions gestartet → pausiert with readback', async () => {
    const paused = ctx({
      assignmentStatus: 'pausiert',
      derivedStatus: 'pausiert',
      timeEvents: [
        { eventType: 'service_start', occurredAt: '2026-06-29T08:35:00Z' },
        { eventType: 'pause_start', occurredAt: '2026-06-29T09:00:00Z' },
      ],
      visitTimes: calculateVisitTimes(
        [
          { eventType: 'service_start', occurredAt: '2026-06-29T08:35:00Z' },
          { eventType: 'pause_start', occurredAt: '2026-06-29T09:00:00Z' },
        ],
        'pausiert',
      ),
      allowedActions: ['end_pause', 'end_service', 'open_route'],
    });
    transitionMock.mockResolvedValue({ ok: true, data: paused });
    resolveMock.mockResolvedValue({ ok: true, data: paused });

    const input = ctx({ assignmentStatus: 'gestartet', derivedStatus: 'gestartet' });
    const result = await startPause(input);

    expect(result.ok).toBe(true);
    expect(transitionMock).toHaveBeenCalledWith(input, 'pausiert', expect.any(Object));
    expect(ensureOpenPauseStartMock).toHaveBeenCalled();
    expect(upsertStateMock).toHaveBeenCalled();
  });
});

describe('ASSIST.STABILIZE.3 endPause', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchEventsMock.mockResolvedValue({ ok: true, data: [] });
    ensureOpenPauseEndMock.mockResolvedValue({ ok: true, data: { id: 'p2', created: true } });
    upsertStateMock.mockResolvedValue({ ok: true, data: { visitId: 'v1', currentStep: 'in_service' } });
  });

  it('transitions pausiert → gestartet with readback', async () => {
    const resumed = ctx({
      assignmentStatus: 'gestartet',
      derivedStatus: 'gestartet',
      visitTimes: calculateVisitTimes(
        [
          { eventType: 'service_start', occurredAt: '2026-06-29T08:35:00Z' },
          { eventType: 'pause_start', occurredAt: '2026-06-29T09:00:00Z' },
          { eventType: 'pause_end', occurredAt: '2026-06-29T09:15:00Z' },
        ],
        'gestartet',
      ),
      timeEvents: [
        { eventType: 'service_start', occurredAt: '2026-06-29T08:35:00Z' },
        { eventType: 'pause_start', occurredAt: '2026-06-29T09:00:00Z' },
        { eventType: 'pause_end', occurredAt: '2026-06-29T09:15:00Z' },
      ],
      allowedActions: ['end_service', 'start_pause', 'open_route'],
    });
    transitionMock.mockResolvedValue({ ok: true, data: resumed });
    resolveMock.mockResolvedValue({ ok: true, data: resumed });

    const input = ctx({
      assignmentStatus: 'pausiert',
      derivedStatus: 'pausiert',
      timeEvents: [
        { eventType: 'service_start', occurredAt: '2026-06-29T08:35:00Z' },
        { eventType: 'pause_start', occurredAt: '2026-06-29T09:00:00Z' },
      ],
    });
    const result = await endPause(input);

    expect(result.ok).toBe(true);
    expect(transitionMock).toHaveBeenCalledWith(input, 'gestartet', expect.any(Object));
    expect(ensureOpenPauseEndMock).toHaveBeenCalled();
  });
});

describe('ASSIST.STABILIZE.3 endService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchEventsMock.mockResolvedValue({ ok: true, data: [{ eventType: 'service_start' }] });
    ensureOpenPauseEndMock.mockResolvedValue({ ok: true, data: { id: 'x', created: false } });
    ensureVisitTimeEventMock.mockResolvedValue({ ok: true, data: { id: 'se1', created: true } });
    upsertStateMock.mockResolvedValue({ ok: true, data: { visitId: 'v1', currentStep: 'documentation' } });
    markAssignmentExecutedMock.mockResolvedValue({ ok: true, data: null });
  });

  it('persists service_end and verifies readback', async () => {
    const ended = ctx({
      assignmentStatus: 'beendet',
      derivedStatus: 'beendet',
      visitTimes: calculateVisitTimes(
        [
          { eventType: 'service_start', occurredAt: '2026-06-29T08:35:00Z' },
          { eventType: 'service_end', occurredAt: '2026-06-29T10:00:00Z' },
        ],
        'beendet',
      ),
      timeEvents: [
        { eventType: 'service_start', occurredAt: '2026-06-29T08:35:00Z' },
        { eventType: 'service_end', occurredAt: '2026-06-29T10:00:00Z' },
      ],
      diagnostics: {
        isServiceStarted: true,
        isServiceEnded: true,
        isTravelEnded: true,
        canEndService: false,
        inconsistentStatus: false,
        repairHint: null,
      },
    });
    transitionMock.mockResolvedValue({ ok: true, data: ended });
    resolveMock.mockResolvedValue({ ok: true, data: ended });

    const input = ctx({ assignmentStatus: 'gestartet' });
    const result = await endService(input);

    expect(result.ok).toBe(true);
    expect(transitionMock).toHaveBeenCalledWith(input, 'beendet', expect.any(Object));
    expect(markAssignmentExecutedMock).not.toHaveBeenCalled();
    expect(ensureVisitTimeEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'service_end' }),
      expect.any(Array),
    );
    expect(upsertStateMock).toHaveBeenCalledWith(
      input.tenantId,
      input.assignmentId,
      'beendet',
      expect.objectContaining({
        visitTimes: expect.objectContaining({ serviceEndedAt: expect.any(String) }),
      }),
    );
  });
});
