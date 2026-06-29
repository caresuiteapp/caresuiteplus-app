import { describe, expect, it, vi } from 'vitest';
import { resolveEffectiveWorkflowStatus } from '@/features/assistWorkflow/resolveEffectiveWorkflowStatus';
import { validateWorkflowTransition } from '@/features/assistWorkflow/assistVisitStateMachine';
import { endService } from '@/features/assistWorkflow/endService';
import type { AssistExecutionContext } from '@/features/assistWorkflow/types';

function mockCtx(overrides: Partial<AssistExecutionContext>): AssistExecutionContext {
  return {
    tenantId: 't1',
    assignmentId: 'a1',
    employeeId: 'e1',
    profileId: 'p1',
    roleKey: 'employee',
    assistVisitId: 'v1',
    assignmentStatus: 'beendet',
    detail: {
      assignmentId: 'a1',
      title: 'Test',
      clientName: 'Client',
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
    visitTimes: {
      driveSeconds: 3600,
      serviceSeconds: null,
      pauseSeconds: null,
      totalSeconds: 3600,
      driveStartedAt: '2026-06-29T08:00:00Z',
      serviceStartedAt: null,
      pauseStartedAt: null,
      arrivedAt: '2026-06-29T09:00:00Z',
      serviceEndedAt: null,
      activeTimer: null,
    },
    timeEvents: [],
    allowedActions: [],
    diagnostics: {
      isServiceStarted: false,
      isServiceEnded: false,
      isTravelEnded: true,
      canEndService: false,
      inconsistentStatus: true,
      repairHint: null,
    },
    ...overrides,
  };
}

describe('resolveEffectiveWorkflowStatus (ASSIST.WORKFLOW.2/3)', () => {
  it('reverts beendet without service_start to angekommen when arrived', () => {
    const r = resolveEffectiveWorkflowStatus('beendet', mockCtx({}).visitTimes);
    expect(r.inconsistent).toBe(true);
    expect(r.effectiveStatus).toBe('angekommen');
    expect(r.repairHint).toContain('Einsatz starten');
  });

  it('reverts gestartet without service_start to angekommen', () => {
    const r = resolveEffectiveWorkflowStatus('gestartet', mockCtx({}).visitTimes);
    expect(r.inconsistent).toBe(true);
    expect(r.effectiveStatus).toBe('angekommen');
  });

  it('returns consistent when service started', () => {
    const ctx = mockCtx({});
    ctx.visitTimes!.serviceStartedAt = '2026-06-29T09:05:00Z';
    const r = resolveEffectiveWorkflowStatus('beendet', ctx.visitTimes);
    expect(r.inconsistent).toBe(false);
    expect(r.effectiveStatus).toBe('beendet');
  });
});

describe('endService (ASSIST.WORKFLOW.2)', () => {
  it('blocks end without service_started_at', async () => {
    vi.mock('@/features/assistWorkflow/internal/transitionAssistExecutionStatus', () => ({
      transitionAssistExecutionStatus: vi.fn(),
    }));

    const result = await endService(mockCtx({ assignmentStatus: 'gestartet' }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Einsatz wurde noch nicht gestartet');
      expect(result.errorCode).toBe('WORKFLOW_SERVICE_NOT_STARTED');
    }
  });
});

describe('validateWorkflowTransition AWF2 guards', () => {
  it('blocks beendet without service start flag', () => {
    const r = validateWorkflowTransition('gestartet', 'beendet', {
      hasServiceStarted: false,
    });
    expect(r.valid).toBe(false);
  });

  it('blocks documentation from gestartet', () => {
    const r = validateWorkflowTransition('gestartet', 'dokumentation_offen');
    expect(r.valid).toBe(false);
  });
});
