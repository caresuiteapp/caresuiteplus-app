import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VisitDispositionDetail } from '@/lib/assist/visitTypes';

const db = vi.hoisted(() => ({ update: vi.fn(), eq: vi.fn(), select: vi.fn(), maybeSingle: vi.fn(), insert: vi.fn() }));
const mirror = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({}) }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: () => db }));
vi.mock('@/lib/assist/assistVisitLegacyAssignmentSync', () => ({
  syncLegacyAssignmentStatusFromVisit: mirror,
  upsertLegacyAssignmentFromVisit: vi.fn(), syncLegacyAssignmentTasksFromVisit: vi.fn(),
}));
vi.mock('@/lib/calendar/calendarSyncService', () => ({
  buildCalendarEventFromVisitDetail: vi.fn(), syncCalendarEventAsync: vi.fn(),
  cancelCalendarEventBySourceAsync: vi.fn(), archiveCalendarEventBySource: vi.fn(),
}));
vi.mock('@/lib/assist/clientBudgetTransactionService', () => ({ markAssignmentExecuted: vi.fn(), storno: vi.fn() }));
import { visitSupabaseRepository } from '@/lib/assist/repositories/visitRepository.supabase';

const detail = {
  id: 'visit', tenantId: 'tenant', assignmentStatus: 'unterschrift_offen',
  executionStatus: 'completed', documentationStatus: 'complete', proofStatus: 'pending',
  actualEndAt: '2026-09-07T09:00:00Z',
} as VisitDispositionDetail;

beforeEach(() => {
  vi.clearAllMocks();
  for (const key of ['update', 'eq', 'select'] as const) db[key].mockReturnValue(db);
  db.insert.mockResolvedValue({ error: null });
  mirror.mockResolvedValue({ ok: true });
  vi.spyOn(visitSupabaseRepository, 'getById').mockResolvedValue({ ok: true, data: detail });
});
afterEach(() => vi.restoreAllMocks());

describe('status mutation readback', () => {
  it('accepts confirmed completion while the client signature remains pending', async () => {
    db.maybeSingle.mockResolvedValue({ data: { id: 'visit', canonical_status: 'completed' }, error: null });
    const result = await visitSupabaseRepository.updateAssignmentStatus('tenant', 'visit', 'abgeschlossen');
    expect(result).toEqual({ ok: true, data: detail });
    expect(db.eq).toHaveBeenCalledWith('tenant_id', 'tenant');
    expect(db.eq).toHaveBeenCalledWith('id', 'visit');
    expect(db.update.mock.calls[0][0]).not.toHaveProperty('proof_status');
    expect(mirror).toHaveBeenCalledOnce();
  });
  it('does not mirror or audit a zero-row update as success', async () => {
    db.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect((await visitSupabaseRepository.updateAssignmentStatus('tenant', 'visit', 'abgeschlossen')).ok).toBe(false);
    expect(mirror).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });
  it('does not mirror a server-rejected or substituted status', async () => {
    db.maybeSingle.mockResolvedValue({ data: { id: 'visit', canonical_status: 'signature_open' }, error: null });
    expect((await visitSupabaseRepository.updateAssignmentStatus('tenant', 'visit', 'abgeschlossen')).ok).toBe(false);
    expect(mirror).not.toHaveBeenCalled();
    db.maybeSingle.mockResolvedValue({ data: null, error: { code: '42501', message: 'permission denied' } });
    expect((await visitSupabaseRepository.updateAssignmentStatus('tenant', 'visit', 'abgeschlossen')).ok).toBe(false);
    expect(mirror).not.toHaveBeenCalled();
  });
});
