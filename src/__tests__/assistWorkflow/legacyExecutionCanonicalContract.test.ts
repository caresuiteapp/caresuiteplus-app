import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VisitDispositionDetail } from '@/lib/assist/visitTypes';
const h = vi.hoisted(() => ({ detail: vi.fn(), list: vi.fn(), write: vi.fn() }));
vi.mock('@/lib/assist/visitService', () => ({ fetchVisitDispositionDetail: h.detail }));
vi.mock('@/lib/permissions', () => ({ enforcePermission: () => null }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: () => null }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
vi.mock('@/lib/services/repositories/executionRepository.supabase', () => ({ executionSupabaseRepository: { list: h.list, updateStatus: h.write } }));
import { checkInAssignment, checkOutAssignment, fetchActiveExecutions, fetchAssignmentExecution, startAssignmentWork } from '@/lib/assist/executionService';
const visit = { id: 'canonical-visit', tenantId: 'tenant', assignmentStatus: 'gestartet', title: 'Begleitung', clientName: 'Klient',
  scheduledStart: '2026-10-11T08:00:00Z', scheduledEnd: '2026-10-11T10:00:00Z', arrivedAt: '2026-10-11T08:03:00Z',
  actualStartAt: '2026-10-11T08:05:00Z', actualEndAt: null, finishedAt: null, documentationNotes: 'Gespeicherte Leistung', durationMinutes: 35,
  tasks: [], allowedStatusTransitions: ['pausiert', 'beendet'], updatedAt: '2026-10-11T19:42:00Z' } as unknown as VisitDispositionDetail;
beforeEach(() => { vi.clearAllMocks(); h.detail.mockResolvedValue({ ok: true, data: visit }); });
describe('legacy overview uses the canonical visit read contract', () => {
  it.each([['angekommen', 'checked_in'], ['gestartet', 'in_progress'], ['pausiert', 'in_progress'], ['beendet', 'in_progress'], ['unterschrift_offen', 'in_progress'], ['abgeschlossen', 'completed'], ['storniert', 'cancelled']])('maps %s to %s without fabricating timestamps', async (status, phase) => {
    h.detail.mockResolvedValue({ ok: true, data: { ...visit, assignmentStatus: status } });
    const result = await fetchAssignmentExecution('canonical-visit::2026-10-11', 'tenant', 'business_admin');
    expect(h.detail).toHaveBeenCalledWith('canonical-visit::2026-10-11', 'tenant', 'business_admin');
    expect(result).toMatchObject({ ok: true, data: { phase, status, checkedInAt: visit.arrivedAt, actualStartAt: visit.actualStartAt,
      checkedOutAt: null, actualEndAt: null, documentationNotes: 'Gespeicherte Leistung' } });
    if (result.ok) expect(result.data.actualStartAt).not.toBe(visit.updatedAt);
  });
  it('does not expose a foreign tenant receipt or invent a time after a failed read', async () => {
    h.detail.mockResolvedValue({ ok: true, data: { ...visit, tenantId: 'other' } });
    expect((await fetchAssignmentExecution('visit', 'tenant', 'business_admin')).ok).toBe(false);
    h.detail.mockResolvedValue({ ok: false, error: 'Read denied' });
    expect(await fetchAssignmentExecution('visit', 'tenant', 'business_admin')).toEqual({ ok: false, error: 'Read denied' });
  });
  it('recognizes stored English active statuses and displays actual planned times', async () => {
    h.list.mockResolvedValue({ ok: true, data: ['arrived', 'started', 'paused', 'completed'].map(status => ({ id: status, title: status, status,
      planned_start_at: 'planned-start', planned_end_at: 'planned-end', created_at: 'created', updated_at: 'unrelated-update' })) });
    const result = await fetchActiveExecutions('tenant', 'business_admin');
    expect(result).toMatchObject({ ok: true, data: [
      { assignmentId: 'arrived', phase: 'checked_in', scheduledStart: 'planned-start', scheduledEnd: 'planned-end' },
      { assignmentId: 'started', phase: 'in_progress' }, { assignmentId: 'paused', phase: 'in_progress' },
    ] });
  });
  it.each([checkInAssignment, startAssignmentWork, checkOutAssignment])('blocks obsolete direct lifecycle writes and directs to the guided visit workflow', async (action) => {
    const result = await action('visit', 'tenant', 'business_admin');
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining('eigene Einsatzdurchführung') });
    expect(h.write).not.toHaveBeenCalled();
  });
});
