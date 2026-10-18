import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ client: {} as object | null, table: vi.fn(), permission: vi.fn(), guard: vi.fn(), createRule: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => state.client }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: state.table }));
vi.mock('@/lib/permissions', () => ({ enforcePermission: state.permission }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: state.guard }));
vi.mock('@/lib/supabase/errors', () => ({ toGermanSupabaseError: (error: { message: string }) => error.message }));
vi.mock('@/lib/wfm/wfmPlanningService', () => ({ saveWfmTravelRule: state.createRule }));
import { DEFAULT_TRAVEL_COMPENSATION_POLICY } from '@/lib/travel/travelCompensationPolicy';
import { cancelOfficeTeamMeeting, saveOfficeTravelRule } from '@/lib/wfm/wfmOfficePlanningActions.web';

const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), update: vi.fn().mockReturnThis(), maybeSingle: vi.fn() };
const rule = { id: 'rule-a', tenantId: 'tenant-a', actorId: 'editor-b', name: 'Wegezeit', minGapMinutes: 0, maxGapMinutes: 180, countsAsWorkTime: true, roundToMinutes: 5, mileageRateCents: 30, travelPolicy: DEFAULT_TRAVEL_COMPENSATION_POLICY, priority: 100, isActive: false, notes: 'Geprüft' };
const savedRule = { id: 'rule-a', tenant_id: 'tenant-a', name: 'Gespeicherte Wegezeit', min_gap_minutes: 0, max_gap_minutes: 180, counts_as_work_time: true, round_to_minutes: 5, mileage_rate_cents: 30, travel_policy_json: DEFAULT_TRAVEL_COMPENSATION_POLICY, priority: 100, is_active: false, notes: 'Geprüft', created_by: 'original-author' };
const permissions = ['time.settings.manage'] as const;
beforeEach(() => {
  vi.clearAllMocks(); state.client = {}; state.permission.mockReturnValue(null); state.guard.mockReturnValue(null); state.table.mockReturnValue(query);
  state.createRule.mockResolvedValue({ ok: true, data: rule }); query.maybeSingle.mockResolvedValue({ data: savedRule, error: null });
});

describe('Web travel rule authorship', () => {
  it('keeps original authorship and row identity out of update payloads', async () => {
    const result = await saveOfficeTravelRule(rule, 'business_admin', permissions);
    expect(result.ok).toBe(true); if (result.ok) expect(result.data).toMatchObject({ id: 'rule-a', name: 'Gespeicherte Wegezeit', isActive: false });
    const payload = query.update.mock.calls[0][0];
    expect(payload).toMatchObject({ name: 'Wegezeit', is_active: false, mileage_rate_cents: 30 });
    for (const key of ['created_by', 'created_at', 'id', 'tenant_id']) expect(payload).not.toHaveProperty(key);
    expect(query.eq).toHaveBeenCalledWith('tenant_id', 'tenant-a'); expect(query.eq).toHaveBeenCalledWith('id', 'rule-a');
    expect(state.createRule).not.toHaveBeenCalled();
  });
  it('keeps the existing creation path with its author for genuinely new rules', async () => {
    const input = { ...rule, id: undefined };
    await saveOfficeTravelRule(input, 'business_admin', permissions);
    expect(state.createRule).toHaveBeenCalledExactlyOnceWith(input); expect(state.table).not.toHaveBeenCalled();
  });
  it('rejects invalid edits before writing', async () => {
    for (const input of [{ ...rule, minGapMinutes: -1 }, { ...rule, maxGapMinutes: -2 }, { ...rule, roundToMinutes: 7 }, { ...rule, mileageRateCents: NaN }, { ...rule, priority: -1 }, { ...rule, name: '  ' }]) {
      expect((await saveOfficeTravelRule(input, 'business_admin', permissions)).ok).toBe(false);
    }
    expect(query.update).not.toHaveBeenCalled();
  });
  it.each([{ data: null }, { data: { ...savedRule, id: 'another-rule' } }, { data: { ...savedRule, tenant_id: 'tenant-b' } }])('does not confirm a missing or mismatched saved rule: $data', async ({ data }) => {
    query.maybeSingle.mockResolvedValue({ data, error: null }); expect((await saveOfficeTravelRule(rule, 'business_admin', permissions)).ok).toBe(false);
  });
});

describe('Web meeting cancellation concurrency', () => {
  it('atomically cancels only the still scheduled meeting in the selected tenant', async () => {
    query.maybeSingle.mockResolvedValue({ data: { id: 'meeting-a', tenant_id: 'tenant-a', status: 'cancelled' }, error: null });
    expect(await cancelOfficeTeamMeeting('tenant-a', 'meeting-a', 'business_admin', permissions)).toEqual({ ok: true, data: true });
    expect(query.update).toHaveBeenCalledExactlyOnceWith({ status: 'cancelled', updated_at: expect.any(String) });
    expect(query.eq.mock.calls).toEqual([['tenant_id', 'tenant-a'], ['id', 'meeting-a'], ['status', 'scheduled']]);
    expect(query.select).toHaveBeenCalledWith('id,tenant_id,status'); expect(query.maybeSingle).toHaveBeenCalledTimes(1);
  });
  it('reports a concurrent completion instead of claiming a cancellation', async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: null });
    const result = await cancelOfficeTeamMeeting('tenant-a', 'meeting-a', 'business_admin', permissions);
    expect(result.ok).toBe(false); if (!result.ok) expect(result.error).toContain('inzwischen geändert oder abgeschlossen');
    expect(query.update).toHaveBeenCalledTimes(1);
  });
  it.each([{ data: { id: 'other', tenant_id: 'tenant-a', status: 'cancelled' } }, { data: { id: 'meeting-a', tenant_id: 'tenant-b', status: 'cancelled' } }, { data: { id: 'meeting-a', tenant_id: 'tenant-a', status: 'completed' } }])('rejects an unconfirmed cancellation: $data', async ({ data }) => {
    query.maybeSingle.mockResolvedValue({ data, error: null }); expect((await cancelOfficeTeamMeeting('tenant-a', 'meeting-a', 'business_admin', permissions)).ok).toBe(false);
  });
  it('preserves server errors and blocks missing connections', async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: { message: 'Zugriff verweigert' } });
    expect(await cancelOfficeTeamMeeting('tenant-a', 'meeting-a', 'business_admin', permissions)).toEqual({ ok: false, error: 'Zugriff verweigert' });
    expect(await saveOfficeTravelRule(rule, 'business_admin', permissions)).toEqual({ ok: false, error: 'Zugriff verweigert' });
    vi.clearAllMocks(); state.client = null;
    expect((await cancelOfficeTeamMeeting('tenant-a', 'meeting-a', 'business_admin', permissions)).ok).toBe(false);
    expect((await saveOfficeTravelRule(rule, 'business_admin', permissions)).ok).toBe(false); expect(state.table).not.toHaveBeenCalled();
  });
  it('enforces effective rights and tenant scope before either mutation', async () => {
    state.permission.mockReturnValue({ ok: false, error: 'Keine Berechtigung' });
    expect((await saveOfficeTravelRule(rule, 'business_admin', [])).ok).toBe(false); expect((await cancelOfficeTeamMeeting('tenant-a', 'meeting-a', 'business_admin', [])).ok).toBe(false);
    expect(state.permission).toHaveBeenCalledWith('business_admin', 'time.settings.manage', { effectivePermissions: [] });
    state.permission.mockReturnValue(null); state.guard.mockReturnValue({ ok: false, error: 'Falscher Mandant' });
    expect((await cancelOfficeTeamMeeting('tenant-b', 'meeting-a', 'business_admin', permissions)).ok).toBe(false);
    expect(state.table).not.toHaveBeenCalled(); expect(state.createRule).not.toHaveBeenCalled();
  });
});
