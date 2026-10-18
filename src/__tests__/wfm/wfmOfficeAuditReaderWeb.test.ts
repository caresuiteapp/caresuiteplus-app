import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WfmOfficeTimeEntry } from '@/types/modules/wfmOfficeTimekeeping';
const state = vi.hoisted(() => ({ reviews: vi.fn(), actions: vi.fn(), audit: vi.fn(), demo: vi.fn(), denied: false }));
vi.mock('@/lib/permissions', () => ({ enforcePermission: () => state.denied ? { ok: false, error: 'Kein Zugriff' } : null }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: () => null }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({}) }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: () => {
  const query: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'order']) query[method] = () => query;
  query.range = (...range: number[]) => Promise.resolve(state.audit(range)); return query;
} }));
vi.mock('@/lib/wfm/wfmOfficeAuditService', () => ({ listWfmOfficeAuditForEntry: (...args: unknown[]) => state.demo(...args) }));
vi.mock('@/lib/wfm/wfmOfficeTimekeepingReads', () => ({ readOfficeReviews: (...args: unknown[]) => state.reviews(...args), readOfficeReviewActions: (...args: unknown[]) => state.actions(...args) }));
vi.mock('@/lib/wfm/wfmOfficeReviewIntegrity', () => ({ officeReviewIdentity: () => ({ referenceKey: 'reference' }) }));
import { listOfficeWebAudit } from '@/lib/wfm/wfmOfficeAuditReader.web';
const entry = { id: 'entry', tenantId: 'tenant-a', employeeId: 'employee-a', workDate: '2026-10-18' } as WfmOfficeTimeEntry;
const load = () => listOfficeWebAudit('tenant-a', 'business_admin', entry.id, entry);
beforeEach(() => {
  state.denied = false; state.demo.mockReset();
  state.reviews.mockReset().mockResolvedValue({ ok: true, data: [{ id: 'review', tenantId: 'tenant-a', employeeId: 'employee-a', referenceKey: 'reference' }] });
  state.actions.mockReset().mockResolvedValue({ ok: true, data: [] }); state.audit.mockReset().mockReturnValue({ data: [], error: null });
});
describe('persisted Web working-time audit', () => {
  it('loads actions for the selected canonical review and orders saved records newest first', async () => {
    state.audit.mockReturnValue({ error: null, data: [{ id: 'old', tenant_id: 'tenant-a', entity_id: 'entry', entity_type: 'wfm_office_time_entry', action: 'correction', summary: 'Korrektur', created_at: '2026-10-17T08:00:00Z' }] });
    state.actions.mockResolvedValue({ ok: true, data: [{ id: 'new', tenantId: 'tenant-a', action: 'review_approved', actorId: 'actor', comment: null, prevStatus: 'pending_review', newStatus: 'approved', createdAt: '2026-10-18T08:00:00Z' }] });
    const result = await load(); expect(result.ok).toBe(true); if (!result.ok) return;
    expect(state.actions).toHaveBeenCalledWith('tenant-a', ['review']); expect(result.data.map(row => row.id)).toEqual(['new', 'old']); expect(result.data[0].summary).toBe('Arbeitszeit genehmigt');
  });
  it('does not conceal missing audit data behind an empty local cache', async () => {
    state.audit.mockReturnValue({ data: null, error: { code: '42P01', message: 'missing table' } });
    expect((await load()).ok).toBe(false); expect(state.demo).not.toHaveBeenCalled();
  });
  it('propagates review and action failures instead of reporting no history', async () => {
    state.reviews.mockResolvedValueOnce({ ok: false, error: 'Reviews unavailable' }); expect(await load()).toEqual({ ok: false, error: 'Reviews unavailable' });
    state.actions.mockResolvedValueOnce({ ok: false, error: 'Actions unavailable' }); expect(await load()).toEqual({ ok: false, error: 'Actions unavailable' });
  });
  it('blocks mismatched context and missing permission before querying', async () => {
    expect((await listOfficeWebAudit('tenant-b', 'business_admin', entry.id, entry)).ok).toBe(false);
    state.denied = true; expect((await load()).ok).toBe(false); expect(state.reviews).not.toHaveBeenCalled();
  });
});
