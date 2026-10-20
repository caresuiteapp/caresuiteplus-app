import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AssistExecutionContext } from '@/features/assistWorkflow/types';
import { resolveAssistExecutionContext } from '@/features/assistWorkflow/resolveAssistExecutionContext';
import { readWorkflowActionConfirmation } from '@/features/assistWorkflow/readWorkflowActionConfirmation';
import { WORKFLOW_CONTEXT_REFRESH_TIMEOUT_MS } from '@/features/assistWorkflow/internal/withWorkflowTimeout';

vi.mock('@/features/assistWorkflow/resolveAssistExecutionContext', () => ({ resolveAssistExecutionContext: vi.fn() }));

const before = {
  tenantId: 'tenant', employeeId: 'employee', assignmentId: 'assignment', assistVisitId: 'visit',
  profileId: 'profile', roleKey: 'employee_portal', assignmentStatus: 'gestartet', derivedStatus: 'gestartet',
  detail: { status: 'gestartet', actualEndAt: null }, visitTimes: { serviceEndedAt: null },
} as unknown as AssistExecutionContext;
const after = {
  ...before, assignmentStatus: 'beendet', derivedStatus: 'beendet',
  detail: { ...before.detail, status: 'beendet', actualEndAt: '2026-10-05T14:07:00.000Z' },
  visitTimes: { ...before.visitTimes, serviceEndedAt: '2026-10-05T14:07:00.000Z' },
} as AssistExecutionContext;
const resolve = vi.mocked(resolveAssistExecutionContext);
beforeEach(() => { resolve.mockReset(); });
afterEach(() => vi.useRealTimers());

describe('fresh workflow confirmation readback', () => {
  it('confirms the exact service end through a read-only request without preloaded UI details', async () => {
    resolve.mockResolvedValue({ ok: true, data: after });
    expect(await readWorkflowActionConfirmation(before, 'end_service')).toEqual({ state: 'confirmed', context: after });
    expect(resolve).toHaveBeenCalledExactlyOnceWith({
      tenantId: 'tenant', assignmentId: 'assignment', employeeId: 'employee',
      profileId: 'profile', roleKey: 'employee_portal', autoRepair: false,
    });
  });

  it('does not confirm an unchanged visit or a status without an end timestamp', async () => {
    resolve.mockResolvedValue({ ok: true, data: before });
    expect((await readWorkflowActionConfirmation(before, 'end_service')).state).toBe('pending');
    resolve.mockResolvedValue({ ok: true, data: { ...before, assignmentStatus: 'beendet', derivedStatus: 'beendet' } });
    expect((await readWorkflowActionConfirmation(before, 'end_service')).state).toBe('pending');
  });

  it.each(['tenantId', 'employeeId', 'assignmentId', 'assistVisitId'] as const)('rejects evidence for another %s', async (key) => {
    resolve.mockResolvedValue({ ok: true, data: { ...after, [key]: 'other' } });
    expect((await readWorkflowActionConfirmation(before, 'end_service')).state).toBe('pending');
  });

  it('returns an unavailable status when the read itself never replies', async () => {
    vi.useFakeTimers();
    resolve.mockReturnValue(new Promise(() => undefined));
    const check = readWorkflowActionConfirmation(before, 'end_service');
    await vi.advanceTimersByTimeAsync(WORKFLOW_CONTEXT_REFRESH_TIMEOUT_MS);
    expect((await check).state).toBe('unavailable');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('leaves persistence unconfirmed after a server error', async () => {
    resolve.mockResolvedValue({ ok: false, error: 'offline' });
    expect((await readWorkflowActionConfirmation(before, 'end_service')).state).toBe('unavailable');
  });
});
