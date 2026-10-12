import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AssistExecutionContext } from '@/features/assistWorkflow/types';

const h = vi.hoisted(() => ({ write: vi.fn() }));
vi.mock('@/lib/portal/employeePortalExecutionLiveService', () => ({ updateLiveEmployeePortalTasksBatch: h.write }));
vi.mock('@/lib/portal/employeePortalExecutionService', () => ({ updateEmployeePortalTasksBatch: h.write }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
import { saveTaskResultsBatch } from '@/features/assistWorkflow/saveTaskResultsBatch';

function context(signatureStatus: string, isLocked = false) {
  return { tenantId: 'tenant', employeeId: 'employee', assignmentId: 'visit', roleKey: 'employee_portal',
    detail: { signatureStatus, isLocked, tasks: [{ id: 'required', required: true, status: 'open' }] } } as AssistExecutionContext;
}
beforeEach(() => {
  vi.clearAllMocks();
  h.write.mockImplementation(async (_tenant, _visit, _employee, _role, updates, detail) => ({ ok: true,
    data: { ...detail, tasks: [{ id: updates[0].taskId, status: updates[0].status }] } }));
});
describe('task edits preserve the signed visit content', () => {
  it.each(['captured', 'locked', 'deferred_to_client_portal', 'administrative_approval_pending'])('blocks edits to a %s snapshot before any server write', async (status) => {
    const result = await saveTaskResultsBatch({ ctx: context(status), updates: [{ taskId: 'required', status: 'done' }] });
    expect(result.ok).toBe(false);
    expect(h.write).not.toHaveBeenCalled();
  });
  it('blocks locked visits even when a stale signature status is pending', async () => {
    expect((await saveTaskResultsBatch({ ctx: context('pending', true), updates: [{ taskId: 'required', status: 'done' }] })).ok).toBe(false);
    expect(h.write).not.toHaveBeenCalled();
  });
  it('permits edits again after documentation correction requires a fresh signature', async () => {
    const result = await saveTaskResultsBatch({ ctx: context('pending'), updates: [{ taskId: 'required', status: 'done' }] });
    expect(result.ok).toBe(true);
    expect(h.write).toHaveBeenCalledOnce();
    if (result.ok) expect(result.data.detail.tasks[0].status).toBe('done');
  });
  it('does not turn untouched required tasks into a signature or completion blocker', async () => {
    const ctx = context('captured');
    expect(await saveTaskResultsBatch({ ctx, updates: [] })).toEqual({ ok: true, data: ctx });
    expect(h.write).not.toHaveBeenCalled();
  });
});
