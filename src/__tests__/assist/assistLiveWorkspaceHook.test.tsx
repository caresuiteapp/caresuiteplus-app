// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ tenant: 'tenant-a', actor: 'actor-a', user: 'user-a', role: 'business_admin', permissions: undefined as string[] | undefined, read: vi.fn(), remove: vi.fn(), channel: vi.fn(), listeners: [] as (() => void)[], status: null as ((status: string) => void) | null }));
vi.mock('react-native', () => ({ Platform: { OS: 'web' } }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => ({ profile: { id: f.actor, roleKey: f.role }, user: { id: f.user } }) }));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => f.tenant }));
vi.mock('@/lib/permissions', () => ({ hasPermission: (role: string) => role === 'business_admin' || role === 'dispatch', hasPermissionInList: (permissions: string[], key: string) => permissions.includes(key) }));
vi.mock('@/lib/performance', () => ({ useDevicePerformance: () => ({ profile: 'normal' }), livePollIntervalMs: () => 30_000 }));
vi.mock('@/hooks/core', () => ({ LIVE_TRACKING_POLL_MS: 30_000 }));
vi.mock('@/hooks/core/useLiveRefresh', () => ({ DEFAULT_LIVE_POLL_MS: 30_000, useLiveRefresh: () => ({ isLiveConnected: false }) }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({ channel: f.channel, removeChannel: f.remove }) }));
vi.mock('@/features/assistLive/getAssistLiveMonitoringWorkspace', () => ({ getAssistLiveMonitoringWorkspace: f.read, buildLiveWorkspaceOverview: (rows: any[], generatedAt: string) => ({ rows, generatedAt, partialData: false, warnings: [] }), liveMonitoringDayKey: (value: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date(value)) }));
import { useAssistLiveMonitoring } from '@/features/assistLive/useAssistLiveMonitoring.web';
const pending = () => { let resolve!: (value: any) => void; const promise = new Promise<any>((done) => { resolve = done; }); return { resolve, promise }; };
const result = (id: string) => ({ ok: true, data: { rows: [{ assignmentId: id }], generatedAt: '2026-10-17T08:00:00Z' } });
let root: Root, host: HTMLDivElement, api: ReturnType<typeof useAssistLiveMonitoring>;
function Harness({ enabled = true }: { enabled?: boolean }) { api = useAssistLiveMonitoring({ enabled, effectivePermissions: f.permissions as any }); return <span>{api.overview?.rows.map((row) => row.assignmentId).join(',')}</span>; }
const render = async (enabled = true) => { await act(async () => root.render(<Harness enabled={enabled} />)); };
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-17T08:05:00Z')); vi.clearAllMocks();
  f.tenant = 'tenant-a'; f.actor = 'actor-a'; f.user = 'user-a'; f.role = 'business_admin'; f.permissions = undefined; f.listeners = []; f.status = null;
  f.read.mockResolvedValue(result('current')); f.remove.mockResolvedValue('ok');
  f.channel.mockImplementation(() => { const channel = { on: (_type: string, _filter: object, listener: () => void) => { f.listeners.push(listener); return channel; }, subscribe: (status: (value: string) => void) => { f.status = status; return channel; } }; return channel; });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); });
describe('Web live monitor identity, realtime and error handling', () => {
  it('reports a connection only after SUBSCRIBED and really refreshes on batched events', async () => {
    await render(); expect(api.isRealtimeConnected).toBe(false); expect(f.listeners).toHaveLength(10);
    await act(async () => { f.status!('SUBSCRIBED'); }); expect(api.isRealtimeConnected).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(700); }); const before = f.read.mock.calls.length;
    await act(async () => { f.listeners[0](); f.listeners[2](); f.listeners[4](); await vi.advanceTimersByTimeAsync(700); }); expect(f.read).toHaveBeenCalledTimes(before + 1);
    await act(async () => { f.status!('CHANNEL_ERROR'); }); expect(api.isRealtimeConnected).toBe(false);
  });
  it('retains last confirmed rows and reports a failed manual refresh', async () => {
    await render(); const oldTime = api.generatedAt; f.read.mockResolvedValue({ ok: false, error: 'Zugriff verweigert' });
    let success = true; await act(async () => { success = await api.refreshWithResult(); });
    expect(success).toBe(false); expect(api.overview?.rows[0].assignmentId).toBe('current'); expect(api.refreshError).toBe('Zugriff verweigert'); expect(api.generatedAt).toBe(oldTime); expect(api.refreshing).toBe(false);
  });
  it('clears old rows for tenant and user switches before replacement reads finish', async () => {
    await render(); const old = pending(), next = pending(); f.read.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
    f.tenant = 'tenant-b'; await render(); expect(api.overview).toBeUndefined(); expect(api.isRealtimeConnected).toBe(false);
    f.user = 'user-b'; await render(); await act(async () => old.resolve(result('wrong-user'))); expect(api.overview).toBeUndefined();
    await act(async () => next.resolve(result('right-user'))); expect(api.overview?.rows[0].assignmentId).toBe('right-user');
  });
  it('clears data and closes the channel when permission is lost or explicitly disabled', async () => {
    await render(); const calls = f.read.mock.calls.length; f.role = 'client_portal'; await render(); expect(api.overview).toBeUndefined(); expect(f.read).toHaveBeenCalledTimes(calls); expect(f.remove).toHaveBeenCalled();
    f.role = 'business_admin'; await render(); await render(false); expect(api.overview).toBeUndefined(); expect(api.loading).toBe(false);
  });
  it('clears and re-queries the day at Berlin midnight, independent of browser timezone', async () => {
    vi.setSystemTime(new Date('2026-10-17T21:59:50Z')); await render(); const next = pending(); f.read.mockReturnValue(next.promise);
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); }); expect(api.overview).toBeUndefined(); expect(f.read).toHaveBeenCalledTimes(2);
    await act(async () => next.resolve(result('next-day'))); expect(api.overview?.rows[0].assignmentId).toBe('next-day');
  });
  it('honours effective permission grants and clears data immediately when revoked', async () => {
    f.role = 'billing'; f.permissions = ['assist.assignments.view']; await render(); expect(api.overview?.rows).toHaveLength(1);
    const calls = f.read.mock.calls.length; f.permissions = []; await render(); expect(api.overview).toBeUndefined(); expect(f.read).toHaveBeenCalledTimes(calls); expect(api.isRealtimeConnected).toBe(false);
  });
  it('keeps a stable refresh callback during normal rerenders', async () => { await render(); const refresh = api.refresh; await render(); expect(api.refresh).toBe(refresh); expect(f.channel).toHaveBeenCalledTimes(1); });
});
