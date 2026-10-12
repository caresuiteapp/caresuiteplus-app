import { beforeEach, expect, it, vi } from 'vitest';
import type { AssignmentDetail } from '@/lib/assist/repositories/assignmentRepository.supabase';
const h = vi.hoisted(() => ({ rpc: vi.fn(), direct: vi.fn(), audit: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({ rpc: h.rpc }) }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: h.direct }));
vi.mock('@/lib/assist/assignmentAuditHelper', () => ({ writeAssignmentAudit: h.audit }));
vi.mock('@/lib/async/deferredTask', () => ({ scheduleDeferredTask: vi.fn() }));
import { assignmentSupabaseRepository as repo } from '@/lib/assist/repositories/assignmentRepository.supabase';
const row = { id: 'assignment', tenantId: 'tenant', employeeId: 'employee', assignmentStatus: 'gestartet',
  actualStartAt: '2026-10-11T08:03:00Z', actualEndAt: null, arrivedAt: '2026-10-11T08:00:00Z', updatedAt: 'unrelated-update' } as AssignmentDetail;
beforeEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); h.rpc.mockResolvedValue({ data: 'assignment', error: null });
  vi.spyOn(repo, 'getById').mockResolvedValueOnce({ ok: true, data: row }).mockResolvedValue({ ok: true, data: { ...row, assignmentStatus: 'pausiert' } }); });
it('returns only actual scoped readback times, even when the caller asks for a fast result', async () => {
  const result = await repo.updateStatus('tenant', 'assignment', 'pausiert', { fastWorkflow: true, actorEmployeeId: 'employee', expectedAssignedEmployeeId: 'employee' });
  expect(result).toMatchObject({ ok: true, data: { assignmentStatus: 'pausiert', actualStartAt: row.actualStartAt, actualEndAt: null, updatedAt: 'unrelated-update' } });
  expect(h.direct).not.toHaveBeenCalled();
});
it('does not weaken a rejected RPC to a direct UPDATE', async () => {
  h.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'denied' } });
  expect((await repo.updateStatus('tenant', 'assignment', 'pausiert')).ok).toBe(false); expect(h.direct).not.toHaveBeenCalled();
});
it.each(['id', 'tenantId', 'assignmentStatus', 'employeeId'])('rejects a foreign or unchanged %s readback', async field => {
  vi.mocked(repo.getById).mockReset().mockResolvedValueOnce({ ok: true, data: row }).mockResolvedValueOnce({ ok: true, data: { ...row, assignmentStatus: 'pausiert', [field]: 'other' } });
  expect((await repo.updateStatus('tenant', 'assignment', 'pausiert', { expectedAssignedEmployeeId: 'employee' })).ok).toBe(false);
});
it('uses a fresh same-status receipt rather than trusting a cached UI snapshot', async () => {
  vi.mocked(repo.getById).mockReset().mockResolvedValue({ ok: true, data: { ...row, assignmentStatus: 'pausiert' } });
  expect((await repo.updateStatus('tenant', 'assignment', 'pausiert', { knownExistingDetail: row })).ok).toBe(true); expect(h.rpc).not.toHaveBeenCalled();
});
it('fails visibly on a missing UUID receipt or denied fresh read', async () => {
  h.rpc.mockResolvedValue({ data: null, error: null }); expect((await repo.updateStatus('tenant', 'assignment', 'pausiert')).ok).toBe(false);
  vi.mocked(repo.getById).mockReset().mockResolvedValue({ ok: false, error: 'read denied' });
  expect(await repo.updateStatus('tenant', 'assignment', 'pausiert')).toEqual({ ok: false, error: 'read denied' });
});
