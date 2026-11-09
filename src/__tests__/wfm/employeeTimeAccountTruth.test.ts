import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ from: vi.fn(), fetch: vi.fn(), range: vi.fn(), events: vi.fn(), resolve: vi.fn(), permission: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({ from: h.from }) }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: () => null }));
vi.mock('@/lib/permissions', () => ({ enforcePermission: h.permission }));
vi.mock('@/lib/wfm/wfmWorkSessionRepository', () => ({
  resolveEmployeeIdForUser: h.resolve, fetchSessionForDate: h.fetch, listEmployeeSessionsBeforeDate: h.range,
  fetchSessionEvents: h.events, todayWorkDate: () => '2026-07-06',
}));
import { getWfmEmployeeTimeAccountOverview, getWfmTimeAccountForMonth, getWfmTodayAmpel } from '@/lib/wfm/wfmTimeAccountService';
const chains: Record<string, ReturnType<typeof chain>> = {};
function chain(data: unknown, error: unknown = null) {
  return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data, error }) };
}
beforeEach(() => {
  vi.clearAllMocks();
  h.permission.mockReturnValue(null); h.resolve.mockResolvedValue({ ok: true, data: 'employee-1' });
  h.fetch.mockResolvedValue({ ok: true, data: null });
  h.range.mockResolvedValue({ ok: true, data: [] });
  chains.workforce_time_accounts = chain(null);
  chains.employee_contract_settings = chain({ work_days: { mon: 4, tue: 4, wed: 4, thu: 4, fri: 4, sat: 0, sun: 0 } });
  h.from.mockImplementation((table) => chains[table]);
});
afterEach(() => vi.useRealTimers());
describe('employee time-account data truth', () => {
  it('uses the own stored monthly account without reading an inaccessible contract', async () => {
    chains.workforce_time_accounts = chain({ id: 'stored', tenant_id: 'tenant', employee_id: 'employee-1', period_year: 2026, period_month: 7, target_minutes: 1800, actual_minutes: 1200, overtime_minutes: 0, undertime_minutes: 600 });
    const result = await getWfmTimeAccountForMonth('tenant', 'user', 'employee_portal', 2026, 7);
    expect(result.ok && result.data.targetMinutes).toBe(1800);
    expect(h.from).not.toHaveBeenCalledWith('employee_contract_settings');
    expect(chains.workforce_time_accounts.eq.mock.calls).toContainEqual(['employee_id', 'employee-1']);
    expect(chains.workforce_time_accounts.eq.mock.calls).toContainEqual(['period_month', 7]);
  });
  it('calculates July target from the contract, keeps zero net work and never fabricates event durations', async () => {
    h.fetch.mockImplementation(async (_tenant, _employee, date) => ({ ok: true, data: date === '2026-07-06' ? { netMinutes: 0, grossMinutes: 90, pauseMinutes: 90 } : date === '2026-07-07' ? { netMinutes: 75, grossMinutes: 80, pauseMinutes: 5 } : null }));
    const result = await getWfmTimeAccountForMonth('tenant', 'user', 'employee_portal', 2026, 7);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.targetMinutes).toBe(23 * 4 * 60);
    expect(result.data.actualMinutes).toBe(75);
    expect(result.data.pauseMinutes).toBe(95);
    expect(h.fetch).toHaveBeenCalledTimes(31);
    expect(h.fetch).toHaveBeenCalledWith('tenant', 'employee-1', '2026-07-31');
  });
  it('exposes a missing or RLS-hidden contract instead of a fictitious full-time deficit', async () => {
    chains.employee_contract_settings = chain(null);
    const result = await getWfmTimeAccountForMonth('tenant', 'user', 'employee_portal', 2026, 7);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain('Sollzeit');
    expect(h.fetch).not.toHaveBeenCalled();
  });
  it('fails a partial month read instead of publishing incomplete totals', async () => {
    h.fetch.mockResolvedValueOnce({ ok: false, error: 'Netzwerkfehler' });
    const result = await getWfmTimeAccountForMonth('tenant', 'user', 'employee_portal', 2026, 7);
    expect(result).toEqual({ ok: false, error: 'Netzwerkfehler' });
  });
  it('reads a later session change when the same month is refreshed', async () => {
    let minutes = 20;
    h.fetch.mockImplementation(async (_tenant, _employee, date) => ({ ok: true, data: date.endsWith('-06') ? { netMinutes: minutes, pauseMinutes: 0 } : null }));
    const before = await getWfmTimeAccountForMonth('tenant', 'user', 'employee_portal', 2026, 7);
    minutes = 100;
    const after = await getWfmTimeAccountForMonth('tenant', 'user', 'employee_portal', 2026, 7);
    expect(before.ok && before.data.actualMinutes).toBe(20);
    expect(after.ok && after.data.actualMinutes).toBe(100);
  });
  it('uses the contractual Monday target for today and respects a valid zero net duration', async () => {
    h.fetch.mockResolvedValue({ ok: true, data: { netMinutes: 0, grossMinutes: 90 } });
    const result = await getWfmTodayAmpel('tenant', 'user', 'employee_portal');
    expect(result.ok && result.data).toEqual({ actualMinutes: 0, targetMinutes: 240, trafficLight: 'red' });
  });
  it('does not read sessions before checking permission', async () => {
    h.permission.mockReturnValue({ ok: false, error: 'Keine Berechtigung' });
    expect(await getWfmTodayAmpel('tenant', 'user', 'client_portal')).toEqual({ ok: false, error: 'Keine Berechtigung' });
    expect(h.fetch).not.toHaveBeenCalled(); expect(h.from).not.toHaveBeenCalled();
  });
  it('counts real elapsed work and an ongoing pause instead of the stored initial zero', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-07-06T10:00:00Z'));
    h.fetch.mockResolvedValue({ ok: true, data: { id: 'active', status: 'paused', isOnline: true, endedAt: null, netMinutes: 0, grossMinutes: 0, pauseMinutes: 0 } });
    h.events.mockResolvedValue({ ok: true, data: [{ eventType: 'clock_in', occurredAt: '2026-07-06T08:00:00Z' }, { eventType: 'pause_start', occurredAt: '2026-07-06T09:30:00Z' }] });
    const result = await getWfmTodayAmpel('tenant', 'user', 'employee_portal');
    expect(result.ok && result.data.actualMinutes).toBe(90);
    expect(h.events).toHaveBeenCalledWith('tenant', 'active');
  });
  it.each([{ ok: false, error: 'Ereignisse nicht erreichbar' }, { ok: true, data: [] }])('reports unavailable active-session events instead of inventing zero work', async reply => {
    h.fetch.mockResolvedValue({ ok: true, data: { id: 'active', status: 'online', isOnline: true, endedAt: null, netMinutes: 0, grossMinutes: 0, pauseMinutes: 0 } });
    h.events.mockResolvedValue(reply);
    expect((await getWfmTodayAmpel('tenant', 'user', 'employee_portal')).ok).toBe(false);
  });
  it('keeps the approved stored totals of a closed session even when its events differ', async () => {
    h.fetch.mockResolvedValue({ ok: true, data: { id: 'closed', status: 'ended', isOnline: false, endedAt: '2026-07-06T09:00:00Z', netMinutes: 30, grossMinutes: 60, pauseMinutes: 30 } });
    expect((await getWfmTodayAmpel('tenant', 'user', 'employee_portal')).ok).toBe(true);
    expect(h.events).not.toHaveBeenCalled();
  });

  it('shows recorded month totals even if the contractual target is unavailable', async () => {
    chains.employee_contract_settings = chain(null);
    h.range.mockResolvedValue({ ok: true, data: [
      { status: 'ended', netMinutes: 83, pauseMinutes: 7 },
      { status: 'ended', netMinutes: 0, grossMinutes: 40, pauseMinutes: 40 },
    ] });
    const result = await getWfmEmployeeTimeAccountOverview('tenant', 'user', 'employee_portal', '2026-07-06');
    expect(result).toEqual({ ok: true, data: {
      monthActualMinutes: 83, monthPauseMinutes: 47, monthTargetMinutes: null, todayTargetMinutes: null,
      closedMonth: false, priorOpenBlocks: false, monthBalanceMinutes: null, scheduleError: null,
    } });
    expect(h.range).toHaveBeenCalledWith('tenant', 'employee-1', '2026-07-01', '2026-07-06');
  });

  it('ignores stale open snapshot actuals but keeps a closed monthly account', async () => {
    const stored = { target_minutes: 400, actual_minutes: 381, pause_minutes: 24, overtime_minutes: 0, undertime_minutes: 19, is_closed: false };
    chains.workforce_time_accounts = chain(stored);
    const open = await getWfmEmployeeTimeAccountOverview('tenant', 'user', 'employee_portal', '2026-07-06');
    expect(open.ok && open.data).toMatchObject({ monthActualMinutes: 0, todayTargetMinutes: 240, closedMonth: false });
    chains.workforce_time_accounts = chain({ ...stored, is_closed: true });
    const closed = await getWfmEmployeeTimeAccountOverview('tenant', 'user', 'employee_portal', '2026-07-06');
    expect(closed.ok && closed.data).toMatchObject({ monthActualMinutes: 381, monthPauseMinutes: 24, monthTargetMinutes: 400, monthBalanceMinutes: -19, closedMonth: true });
    expect(h.range).toHaveBeenCalledTimes(1);
  });

  it('distinguishes a read failure from an empty month or an unavailable schedule', async () => {
    h.range.mockResolvedValue({ ok: false, error: 'Zeitdaten nicht erreichbar' });
    const result = await getWfmEmployeeTimeAccountOverview('tenant', 'user', 'employee_portal', '2026-07-06');
    expect(result).toEqual({ ok: false, error: 'Zeitdaten nicht erreichbar' });
  });

  it('does not extrapolate an unfinished past session to the current day', async () => {
    h.range.mockResolvedValue({ ok: true, data: [
      { status: 'office', isOnline: true, startedAt: '2026-07-03T06:00:00Z', netMinutes: 35, pauseMinutes: 0 },
    ] });
    const result = await getWfmEmployeeTimeAccountOverview('tenant', 'user', 'employee_portal', '2026-07-06');
    expect(result.ok && result.data).toMatchObject({ monthActualMinutes: 35, priorOpenBlocks: true });
    expect(h.events).not.toHaveBeenCalled();
  });
});
