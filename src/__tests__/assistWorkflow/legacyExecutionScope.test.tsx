// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ auth: {} as Record<string, unknown>, fetch: vi.fn(), checkIn: vi.fn(), start: vi.fn(), checkOut: vi.fn() }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => h.auth }));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => 'tenant' }));
vi.mock('react-native', () => ({ Platform: { OS: 'web' }, AppState: { addEventListener: () => ({ remove() {} }) } }));
vi.mock('@/hooks/core/useLiveRefresh', () => ({ OPERATIONAL_LIVE_POLL_MS: 5000, DEFAULT_LIVE_POLL_MS: 30000, useLiveRefresh: () => ({ isLiveConnected: false }) }));
vi.mock('@/lib/services/queryTimeout', () => ({ withServiceQueryTimeout: (p: Promise<unknown>) => p }));
vi.mock('@/lib/realtime', () => ({ subscribeToAssistOperationsChanges: vi.fn() }));
vi.mock('@/lib/assist', () => ({ fetchAssignmentExecution: h.fetch, checkInAssignment: h.checkIn, startAssignmentWork: h.start, checkOutAssignment: h.checkOut }));
import { useAssignmentExecution } from '@/hooks/useAssignmentExecution';
let root: Root, host: HTMLDivElement, state: ReturnType<typeof useAssignmentExecution>;
const execution = { assignmentId: 'visit', tenantId: 'tenant', phase: 'pending', status: 'geplant' };
const deferred = <T,>() => { let resolve!: (v: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; };
function Probe() { const result = useAssignmentExecution('visit'); React.useLayoutEffect(() => { state = result; }); return <div>{result.data?.phase}:{result.error}:{result.successMessage}</div>; }
const render = () => act(async () => root.render(<Probe />));
beforeEach(() => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true; vi.clearAllMocks();
  h.auth = { profile: { id: 'profile', roleKey: 'owner' }, user: { id: 'user-A' } };
  h.fetch.mockResolvedValue({ ok: true, data: execution });
  h.checkIn.mockResolvedValue({ ok: false, error: 'Liveaktion wurde nicht bestätigt.' });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
it('shows mutation failures without an unconfirmed success message', async () => {
  await render(); await act(async () => { expect(await state.checkIn()).toBeNull(); });
  expect(host.textContent).toContain('Liveaktion wurde nicht bestätigt.'); expect(state.successMessage).toBeNull();
});
it('locks arrival and start together before React can render another tap', async () => {
  const write = deferred<any>(); h.checkIn.mockReturnValue(write.promise); await render();
  let first!: Promise<unknown>; await act(async () => { first = state.checkIn(); expect(await state.startWork()).toBeNull(); });
  expect(h.checkIn).toHaveBeenCalledTimes(1); expect(h.start).not.toHaveBeenCalled();
  await act(async () => { write.resolve({ ok: true, data: { ...execution, phase: 'checked_in' } }); await first; });
  expect(state.actionLoading).toBe(false); expect(state.data?.phase).toBe('checked_in');
});
it('clears prior data and ignores a late write when the account changes on the same visit', async () => {
  const write = deferred<any>(); h.checkIn.mockReturnValue(write.promise); await render();
  let first!: Promise<unknown>; await act(async () => { first = state.checkIn(); });
  h.auth = { ...h.auth, user: { id: 'user-B' } }; h.fetch.mockResolvedValue({ ok: false, error: 'B denied' }); await render();
  expect(state.data).toBeNull(); expect(state.actionLoading).toBe(false);
  await act(async () => { write.resolve({ ok: true, data: { ...execution, phase: 'checked_in' } }); await first; });
  expect(state.data).toBeNull(); expect(state.successMessage).toBeNull(); expect(host.textContent).toContain('B denied');
});
it('ignores a retained callback after detach', async () => {
  await render(); const action = state.checkIn; await act(async () => root.unmount());
  expect(await action()).toBeNull(); expect(h.checkIn).not.toHaveBeenCalled();
});
