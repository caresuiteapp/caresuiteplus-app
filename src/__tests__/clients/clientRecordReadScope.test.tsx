// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ tenant: 'tenant-a', actor: 'actor-a', read: true, sensitive: true, full: vi.fn(), record: vi.fn(), subscribe: vi.fn() }));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => h.tenant }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => ({ user: { id: h.actor }, profile: { id: h.actor, roleKey: 'business_admin' }, portalSession: null }) }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ can: (key: string) => key === 'office.clients.view' ? h.read : key === 'office.clients.view_sensitive' && h.sensitive }) }));
vi.mock('@/lib/clients', () => ({ fetchClientFullDetail: h.full }));
vi.mock('@/lib/clients/clientRecordService', () => ({ fetchClientRecord: h.record }));
vi.mock('@/lib/realtime', () => ({ subscribeToClientRecordChanges: h.subscribe }));
vi.mock('@/hooks/core/useLiveRefresh', () => ({ DEFAULT_LIVE_POLL_MS: 60000, useLiveRefresh: () => ({ isLiveConnected: false }) }));
vi.mock('@/lib/services/queryTimeout', () => ({ NATIVE_SERVICE_QUERY_TIMEOUT_MS: 30000, withServiceQueryTimeout: (request: unknown) => request }));
vi.mock('@/hooks/core', async () => ({ useAsyncQuery: (await import('@/hooks/core/useAsyncQuery')).useAsyncQuery }));
import { useClientFullDetail } from '@/hooks/useClientFullDetail';
import { useClientRecord } from '@/hooks/useClientRecord';

type Response = { ok: true; data: any };
let root: Root, host: HTMLDivElement, pending: ((response: Response) => void)[], snapshot: any, id: string;
beforeEach(() => {
  vi.clearAllMocks(); Object.assign(h, { tenant: 'tenant-a', actor: 'actor-a', read: true, sensitive: true });
  pending = []; id = 'client-a'; snapshot = null;
  const load = () => new Promise<Response>(resolve => pending.push(resolve));
  h.full.mockImplementation(load); h.record.mockImplementation(load);
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const detail = (label: string) => ({ id, tenantId: h.tenant, core: { diagnoses: [label] } });

describe.each(['full', 'record'] as const)('actual %s record hook with real async query scope', kind => {
  function Probe() {
    const value = kind === 'full' ? useClientFullDetail(id) : useClientRecord(id);
    snapshot = { ...value, data: kind === 'full' ? (value as ReturnType<typeof useClientFullDetail>).data : (value as ReturnType<typeof useClientRecord>).detail };
    return <span>{snapshot.data?.core.diagnoses.join(',') ?? 'no-record'}</span>;
  }
  const render = async () => { await act(async () => root.render(<Probe />)); };
  const resolve = async (index: number, label: string) => {
    const value = detail(label);
    await act(async () => pending[index]({ ok: true, data: kind === 'full' ? value : { detail: value, careContexts: ['daily_assistance'], tabs: ['uebersicht'] } }));
  };
  const calls = () => kind === 'full' ? h.full.mock.calls : h.record.mock.calls;

  it.each(['actor', 'tenant', 'record'] as const)('clears previous %s data immediately and ignores a late earlier response', async change => {
    await render(); await resolve(0, 'old-sensitive');
    expect(host.textContent).toContain('old-sensitive');
    await act(async () => { void snapshot.refresh(); });
    if (change === 'actor') h.actor = 'actor-b';
    if (change === 'tenant') h.tenant = 'tenant-b';
    if (change === 'record') id = 'client-b';
    await render();
    expect(snapshot.data).toBeNull(); expect(host.textContent).toBe('no-record');
    await resolve(1, 'late-old-response');
    expect(snapshot.data).toBeNull();
    await resolve(2, 'new-authorized');
    expect(host.textContent).toContain('new-authorized');
  });

  it('clears sensitive data before a reduced-rights read completes', async () => {
    await render(); await resolve(0, 'sensitive'); h.sensitive = false; await render();
    expect(snapshot.data).toBeNull(); expect(host.textContent).not.toContain('sensitive');
    expect(calls()[1]).toEqual(['tenant-a', 'client-a', { canViewSensitive: false }]);
    await resolve(1, 'Geschützt'); expect(host.textContent).toBe('Geschützt');
  });

  it('denies revoked read permission without retaining data or starting another read', async () => {
    await render(); await resolve(0, 'sensitive'); h.read = false; await render();
    expect(snapshot.data).toBeNull(); expect(snapshot.loading).toBe(false);
    expect(snapshot.error).toContain('Leserechte'); expect(calls()).toHaveLength(1);
  });
});
