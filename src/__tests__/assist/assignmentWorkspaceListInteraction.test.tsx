// @vitest-environment happy-dom
// State, filtering and request boundaries only; happy-dom does not verify browser layout.
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AssignmentListItem } from '@/types/modules/assist';
import type { ServiceResult } from '@/types';
const h = vi.hoisted(() => ({ tenant: 'tenant-a' as string | null, actor: 'actor-a', employee: 'employee-admin', fetch: vi.fn() }));
vi.mock('react-native', () => ({ Platform: { OS: 'web' }, AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) } }));
vi.mock('@/hooks/core', async () => ({ useAsyncQuery: (await import('@/hooks/core/useAsyncQuery')).useAsyncQuery, OPERATIONAL_LIVE_POLL_MS: 15000 }));
vi.mock('@/hooks/core/useLiveRefresh', () => ({ useLiveRefresh: () => ({ isLiveConnected: false }), DEFAULT_LIVE_POLL_MS: 30000 }));
vi.mock('@/lib/assist', () => ({ fetchAssignmentList: h.fetch }));
vi.mock('@/lib/realtime', () => ({ subscribeToAssistOperationsChanges: vi.fn() }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => ({ profile: { id: h.actor, employeeId: h.employee, roleKey: 'business_admin' } }) }));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => h.tenant }));
import { useAssignmentList } from '@/hooks/useAssignmentList.web';

let state: ReturnType<typeof useAssignmentList>, root: Root, host: HTMLDivElement;
function Harness() { state = useAssignmentList(); return <div>{state.items.map(item => item.id).join(',')} {state.error} {state.refreshError} {state.showSuccess ? 'Aktualisiert' : ''}</div>; }
const row = (id = 'visit-a', changes: Partial<AssignmentListItem> = {}): AssignmentListItem => ({ id, tenantId: 'tenant-a', title: 'Haushalt', clientName: 'Lena', employeeName: 'Anna', employeeId: 'employee-1', location: 'Herne', status: 'aktiv', assignmentStatus: 'bestaetigt', planningStatus: 'confirmed', executionStatus: 'pending', scheduledStart: '2026-10-16T08:00:00Z', scheduledEnd: '2026-10-16T09:00:00Z', updatedAt: '2026-10-16T08:00:00Z', ...changes });
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
async function render() { await act(async () => { root.render(<Harness />); }); }
async function change(action: () => void) { await act(async () => { action(); }); }
beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-16T08:00:00Z'));
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  h.tenant = 'tenant-a'; h.actor = 'actor-a'; h.employee = 'employee-admin';
  h.fetch.mockResolvedValue({ ok: true, data: [row()] });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => { root.unmount(); }); host.remove(); vi.useRealTimers(); });

describe('Web assignment list interaction and scope', () => {
  it('starts with today, keeps historic follow-up discoverable, and passes the actor profile to the read service', async () => {
    h.fetch.mockResolvedValue({ ok: true, data: [row(), row('historic', { scheduledStart: '2026-07-01T08:00:00Z', executionStatus: 'completed', proofStatus: 'pending' })] });
    await render();
    expect(state.items.map(item => item.id)).toEqual(['visit-a']);
    expect(state.dateRange).toBe('today'); expect(state.allStats.follow_up).toBe(1); expect(state.workspaceStats.follow_up).toBe(0);
    expect(h.fetch).toHaveBeenCalledWith('tenant-a', 'business_admin', expect.objectContaining({ id: 'actor-a', employeeId: 'employee-admin' }));
    await change(() => { state.setDateRange('all'); state.setStatusFilter('follow_up'); });
    expect(state.items.map(item => item.id)).toEqual(['historic']);
  });
  it('keeps KPI counts before the status filter so they do not collapse after a selection', async () => {
    h.fetch.mockResolvedValue({ ok: true, data: [row(), row('running', { executionStatus: 'in_progress' }), row('ended', { executionStatus: 'completed' })] });
    await render(); await change(() => state.setStatusFilter('running'));
    expect(state.items.map(item => item.id)).toEqual(['running']);
    expect(state.workspaceStats).toMatchObject({ total: 3, planned: 1, running: 1, follow_up: 1 });
  });
  it('resets pagination immediately for employee, period, service, search and sorting changes', async () => {
    h.fetch.mockResolvedValue({ ok: true, data: Array.from({ length: 30 }, (_, i) => row(`visit-${i}`)) });
    await render(); expect(state.items).toHaveLength(12);
    const checks = [() => state.setEmployeeFilter('employee-1'), () => state.setDateRange('all'), () => state.setServiceFilter('Haushalt'), () => state.setSearch('Lena'), () => state.setSortKey('time_desc')];
    for (const filter of checks) {
      await change(() => state.loadMore()); expect(state.items).toHaveLength(24);
      await change(filter); expect(state.items).toHaveLength(12); expect(state.filteredCount).toBe(30);
    }
  });
  it('hides only the deleted ID, preserving a separate real visit with identical labels and times', async () => {
    h.fetch.mockResolvedValue({ ok: true, data: [row('first'), row('second')] });
    await render(); await change(() => state.dismissDeletedAssignment('first'));
    expect(state.allItems.map(item => item.id)).toEqual(['second']);
    await act(async () => { await state.refresh(); });
    expect(state.allItems.map(item => item.id)).toEqual(['second']);
  });
  it('preserves previous rows on a failed refresh and never announces a false success', async () => {
    await render(); await act(async () => { await state.refresh(); }); expect(state.showSuccess).toBe(true);
    h.fetch.mockResolvedValue({ ok: false, error: 'Zugriff verweigert' });
    await act(async () => { await state.refresh(); });
    expect(state.items).toHaveLength(1); expect(state.refreshError).toBe('Zugriff verweigert'); expect(state.showSuccess).toBe(false);
  });
  it('rejects foreign-tenant rows even if an upstream result mistakenly contains them', async () => {
    h.fetch.mockResolvedValue({ ok: true, data: [row(), row('foreign', { tenantId: 'tenant-b' })] });
    await render(); expect(state.allItems.map(item => item.id)).toEqual(['visit-a']);
  });
  it('clears rows and filters immediately on tenant switch and ignores a late prior response', async () => {
    await render(); await change(() => state.setSearch('Lena'));
    const old = deferred<ServiceResult<AssignmentListItem[]>>(), next = deferred<ServiceResult<AssignmentListItem[]>>();
    h.fetch.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
    let refresh!: Promise<void>; await change(() => { refresh = state.refresh(); });
    h.tenant = 'tenant-b'; await render(); expect(state.allItems).toEqual([]); expect(state.search).toBe('');
    await act(async () => { old.resolve({ ok: true, data: [row('late')] }); await refresh; });
    expect(state.allItems).toEqual([]); expect(state.showSuccess).toBe(false);
    await act(async () => { next.resolve({ ok: true, data: [row('new', { tenantId: 'tenant-b' })] }); });
    expect(state.items.map(item => item.id)).toEqual(['new']);
  });
  it('clears account-bound tombstones and filters when the effective employee changes', async () => {
    await render(); await change(() => { state.dismissDeletedAssignment('visit-a'); state.setEmployeeFilter('employee-1'); });
    expect(state.allItems).toEqual([]); h.employee = 'employee-other'; await render();
    expect(state.allItems).toHaveLength(1); expect(state.employeeFilter).toBe('all');
  });
  it('does not show an empty organization as an endlessly loading or successful list', async () => {
    h.tenant = null; await render(); expect(h.fetch).not.toHaveBeenCalled();
    expect(state.loading).toBe(false); expect(state.error).toBe('Kein Unternehmen ausgewählt.'); expect(state.showSuccess).toBe(false);
  });
  it('does not silently broaden an invalid custom date range', async () => {
    await render(); await change(() => { state.setDateRange('custom'); state.setDateFrom('2026-10-17'); state.setDateTo('2026-10-16'); });
    expect(state.dateRangeError).toContain('Enddatum'); expect(state.items).toEqual([]);
    await change(() => state.setDateFrom('2026-10-16')); expect(state.dateRangeError).toBeNull(); expect(state.items).toHaveLength(1);
  });
});
