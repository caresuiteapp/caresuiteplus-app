import { describe, expect, it, vi, beforeEach } from 'vitest';
import { repairWorkflowState } from '@/features/assistWorkflow/repairWorkflowState';
import type { AssistExecutionContext } from '@/features/assistWorkflow/types';
import { calculateVisitTimes } from '@/features/assistWorkflow/calculateVisitTimes';
import { deriveWorkflowStatus } from '@/features/assistWorkflow/deriveWorkflowStatus';

const resolveMock = vi.fn();
const rpcMock = vi.fn();

vi.mock('@/features/assistWorkflow/resolveAssistExecutionContext', () => ({
  resolveAssistExecutionContext: (...args: unknown[]) => resolveMock(...args),
}));

vi.mock('@/lib/services/mode', () => ({
  getServiceMode: () => 'supabase',
}));

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => ({
    rpc: (...args: unknown[]) => rpcMock(...args),
  }),
}));

function baseCtx(overrides: Partial<AssistExecutionContext>): AssistExecutionContext {
  const visitTimes = calculateVisitTimes(
    [
      { eventType: 'drive_start', occurredAt: '2026-07-01T15:28:00Z' },
      { eventType: 'arrive', occurredAt: '2026-07-01T15:29:00Z' },
    ],
    'beendet',
  );
  const workflow = deriveWorkflowStatus('beendet', visitTimes);
  return {
    tenantId: '56180c22-b894-4fab-b55e-a563c94dd6e7',
    assignmentId: '70f800b8-a04f-44ae-846f-dcc7f6f6497a',
    employeeId: '1bf39e72-8ae1-480e-9dfb-bcb5aa7b6a4f',
    profileId: 'p1',
    roleKey: 'employee_portal',
    assistVisitId: '70f800b8-a04f-44ae-846f-dcc7f6f6497a',
    assignmentStatus: 'beendet',
    derivedStatus: workflow.derivedStatus,
    consistencyStatus: workflow.consistencyStatus,
    inconsistencies: workflow.inconsistencies,
    repairOptions: workflow.repairOptions,
    detail: {} as AssistExecutionContext['detail'],
    liveContext: null,
    visitTimes,
    timeEvents: [],
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

describe('repairWorkflowState regression guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not downgrade beendet to angekommen when service_end exists', async () => {
    const visitTimes = calculateVisitTimes(
      [
        { eventType: 'drive_start', occurredAt: '2026-07-01T15:28:00Z' },
        { eventType: 'arrive', occurredAt: '2026-07-01T15:29:00Z' },
        { eventType: 'service_end', occurredAt: '2026-07-01T18:32:00Z' },
      ],
      'beendet',
    );
    const ctx = baseCtx({ visitTimes });

    const result = await repairWorkflowState(ctx, { autoOnly: true });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.repaired).toBe(false);
    }
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('does not downgrade post-service status without service_end timestamp', async () => {
    const ctx = baseCtx({
      assignmentStatus: 'beendet',
      derivedStatus: 'angekommen',
    });

    const result = await repairWorkflowState(ctx, { autoOnly: true });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.repaired).toBe(false);
    }
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
