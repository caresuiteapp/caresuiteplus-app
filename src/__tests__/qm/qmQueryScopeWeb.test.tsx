// @vitest-environment happy-dom
import React, { act, useLayoutEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServiceResult } from '@/types';

const api = vi.hoisted(() => ({
  auth: {} as any, tenant: null as string | null, role: 'business_admin',
  permissions: ['qm.view'] as string[], demo: false, filter: 'all',
  confirm: vi.fn(), fetcher: vi.fn(),
}));
vi.mock('react-native', () => ({ Platform: { OS: 'web' }, AppState: { addEventListener: () => ({ remove() {} }) } }));
vi.mock('@/hooks/core/useLiveRefresh', () => ({ DEFAULT_LIVE_POLL_MS: 15_000, useLiveRefresh: () => ({ isLiveConnected: false }) }));
vi.mock('@/hooks/core', async () => ({ useAsyncQuery: (await vi.importActual<typeof import('@/hooks/core/useAsyncQuery')>('@/hooks/core/useAsyncQuery')).useAsyncQuery }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => api.auth }));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => api.tenant }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({
  roleKey: api.role, tenantId: api.tenant, permissions: api.permissions,
  can: (permission: string) => api.permissions.includes(permission),
  check: (permission: string) => ({ allowed: api.permissions.includes(permission), reason: 'QM-Lesezugriff ist nicht freigegeben.' }),
}) }));
vi.mock('@/lib/supabase/config', () => ({ isDemoMode: () => api.demo }));
vi.mock('@/lib/qm/confirmQmReadScope.web', () => ({ confirmQmReadScope: api.confirm }));

import { useQmTenantQuery } from '@/hooks/qm/useQmBase.web';

type Data = { label: string };
type Query = ReturnType<typeof useQmTenantQuery<Data>>;
const id = (number: number) => `66666666-6666-4666-8666-${String(number).padStart(12, '0')}`;
const auth = (person = 1, tenant = 10) => ({
  authReady: true, isAuthenticated: true, isLoading: false, profileBootstrapError: null,
  profile: { id: id(person), tenantId: id(tenant), roleKey: 'business_admin' },
  user: { id: id(person + 100), roleKey: 'business_admin' },
  session: { user: { id: id(person + 100), roleKey: 'business_admin' }, accessToken: `private-test-token-${person}`, expiresAt: null },
  portalSession: null,
});
const deferred = <T,>() => {
  let resolve!: (result: T) => void;
  return { promise: new Promise<T>(done => { resolve = done; }), resolve: (result: T) => resolve(result) };
};
let host: HTMLDivElement, root: Root, query: Query;
const seen: (Data | null)[] = [];
function Reader() {
  query = useQmTenantQuery<Data>(api.fetcher, [api.filter]);
  useLayoutEffect(() => { seen.push(query.data); });
  return <div><output>{query.data?.label ?? ''}</output><span role="status">{query.loading ? 'Wird geprüft' : query.error ?? query.refreshError ?? ''}</span></div>;
}
const render = async () => { await act(async () => root.render(<Reader />)); };
const visible = () => host.querySelector('output')?.textContent;
const refresh = async () => { await act(async () => { await query.refresh(); }); };

beforeEach(() => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  api.auth = auth(); api.tenant = id(10); api.role = 'business_admin'; api.permissions = ['qm.view'];
  api.demo = false; api.filter = 'all'; seen.length = 0;
  api.confirm.mockReset().mockResolvedValue({ ok: true, data: undefined });
  api.fetcher.mockReset().mockResolvedValue({ ok: true, data: { label: 'Eigene QM-Daten' } });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe('actual QM Web query with actual shared async-query lifecycle', () => {
  it('allows distinct profile/auth IDs only after successful confirmation of the captured scope', async () => {
    const confirmation = deferred<ServiceResult<void>>();
    api.confirm.mockReturnValueOnce(confirmation.promise);
    await render();
    expect(api.fetcher).not.toHaveBeenCalled();
    expect(visible()).toBe('');
    expect(query.loading).toBe(true);
    expect(api.confirm).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: id(10), profileId: id(1), authUserId: id(101), roleKey: 'business_admin',
    }), expect.any(Function));
    await act(async () => confirmation.resolve({ ok: true, data: undefined }));
    expect(api.fetcher).toHaveBeenCalledExactlyOnceWith(id(10), 'business_admin');
    expect(visible()).toBe('Eigene QM-Daten');
    expect(host.textContent).not.toContain('private-test-token');
  });

  it('does not dispatch a data read when the actual identity confirmation fails', async () => {
    api.confirm.mockResolvedValue({ ok: false, error: 'Das angemeldete Profil ist nicht bestätigt.' });
    await render();
    expect(api.fetcher).not.toHaveBeenCalled();
    expect(visible()).toBe('');
    expect(query.error).toBe('Das angemeldete Profil ist nicht bestätigt.');
    api.confirm.mockResolvedValue({ ok: true, data: undefined });
    await refresh();
    expect(visible()).toBe('Eigene QM-Daten');
  });

  it('clears previous tenant data immediately and rejects an older pending response', async () => {
    await render();
    const pendingOld = deferred<ServiceResult<Data>>();
    api.fetcher.mockReturnValueOnce(pendingOld.promise);
    let oldRefresh!: Promise<void>;
    await act(async () => { oldRefresh = query.refresh(); });
    const pendingNew = deferred<ServiceResult<Data>>();
    api.fetcher.mockReturnValueOnce(pendingNew.promise);
    api.auth = auth(1, 20); api.tenant = id(20);
    const before = seen.length;
    await render();
    expect(visible()).toBe('');
    expect(seen.slice(before).every(value => value === null)).toBe(true);
    await act(async () => pendingNew.resolve({ ok: true, data: { label: 'Neuer Mandant' } }));
    expect(visible()).toBe('Neuer Mandant');
    await act(async () => { pendingOld.resolve({ ok: true, data: { label: 'Alter Mandant verspätet' } }); await oldRefresh; });
    expect(visible()).toBe('Neuer Mandant');
    expect(seen.some(value => value?.label === 'Alter Mandant verspätet')).toBe(false);
  });

  it('cannot start an old account data read after its pending confirmation finishes', async () => {
    const oldConfirmation = deferred<ServiceResult<void>>();
    api.confirm.mockReturnValueOnce(oldConfirmation.promise);
    await render();
    api.auth = auth(2); api.fetcher.mockResolvedValue({ ok: true, data: { label: 'Zweites Konto' } });
    await render();
    expect(visible()).toBe('Zweites Konto');
    expect(api.fetcher).toHaveBeenCalledTimes(1);
    await act(async () => oldConfirmation.resolve({ ok: true, data: undefined }));
    expect(api.fetcher).toHaveBeenCalledTimes(1);
    expect(visible()).toBe('Zweites Konto');
  });

  it('hides old data on local permission loss and retained refresh callbacks cannot dispatch reads', async () => {
    await render();
    const oldRefresh = query.refresh;
    api.permissions = [];
    await render();
    expect(visible()).toBe('');
    expect(query.error).toBe('QM-Lesezugriff ist nicht freigegeben.');
    await act(async () => oldRefresh());
    expect(api.fetcher).toHaveBeenCalledTimes(1);
    api.permissions = ['qm.view'];
    const next = deferred<ServiceResult<Data>>(); api.fetcher.mockReturnValueOnce(next.promise);
    await render();
    expect(visible()).toBe('');
    await act(async () => next.resolve({ ok: true, data: { label: 'Neu bestätigt' } }));
    expect(visible()).toBe('Neu bestätigt');
  });

  it('withdraws existing data when the server no longer confirms the scope on refresh', async () => {
    await render();
    api.confirm.mockResolvedValue({ ok: false, error: 'QM-Zugriff wurde entzogen.' });
    await refresh();
    expect(visible()).toBe('');
    expect(host.textContent).toContain('QM-Zugriff wurde entzogen.');
    expect(api.fetcher).toHaveBeenCalledTimes(1);
    api.confirm.mockResolvedValue({ ok: true, data: undefined });
    api.fetcher.mockResolvedValue({ ok: true, data: { label: 'Wieder bestätigter Stand' } });
    await refresh();
    expect(visible()).toBe('Wieder bestätigter Stand');
  });

  it('keeps a confirmed dataset explicitly stale on a data refresh failure, separate from access denial', async () => {
    await render();
    api.fetcher.mockResolvedValue({ ok: false, error: 'Datenabfrage fehlgeschlagen.' });
    await refresh();
    expect(visible()).toBe('Eigene QM-Daten');
    expect(query.refreshError).toBe('Datenabfrage fehlgeschlagen.');
    expect(api.confirm).toHaveBeenCalledTimes(2);
  });

  it.each(['loading', 'logout', 'expired', 'missingTenant', 'portal'] as const)('does not expose prior data or dispatch reads for %s', async state => {
    await render();
    if (state === 'loading') api.auth = { ...api.auth, isLoading: true };
    if (state === 'logout') api.auth = { ...api.auth, isAuthenticated: false };
    if (state === 'expired') api.auth = { ...api.auth, session: { ...api.auth.session, expiresAt: 0 } };
    if (state === 'missingTenant') api.tenant = null;
    if (state === 'portal') api.auth = { ...api.auth, portalSession: { portal: 'client' } };
    await render();
    expect(visible()).toBe('');
    await refresh();
    expect(api.fetcher).toHaveBeenCalledTimes(1);
    if (state === 'loading') expect(query.loading).toBe(true);
    if (state === 'missingTenant') expect(query.error).toContain('Kein Mandant');
  });

  it('discards a previous filter dataset while the requested register selection is loading', async () => {
    await render();
    const next = deferred<ServiceResult<Data>>(); api.fetcher.mockReturnValueOnce(next.promise);
    api.filter = 'pending';
    await render();
    expect(visible()).toBe('');
    await act(async () => next.resolve({ ok: true, data: { label: 'Offene Einträge' } }));
    expect(visible()).toBe('Offene Einträge');
  });

  it('hides the dataset on session expiry without waiting for an unrelated rerender', async () => {
    vi.useFakeTimers();
    api.auth = { ...api.auth, session: { ...api.auth.session, expiresAt: Date.now() + 1_000 } };
    await render();
    expect(visible()).toBe('Eigene QM-Daten');
    await act(async () => { await vi.advanceTimersByTimeAsync(1_001); });
    expect(visible()).toBe('');
    await refresh();
    expect(api.fetcher).toHaveBeenCalledTimes(1);
  });

  it('suspends hidden-page data and confirms the same account again before showing it on return', async () => {
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    await render();
    visibility.mockReturnValue('hidden');
    await act(async () => document.dispatchEvent(new Event('visibilitychange')));
    expect(visible()).toBe('');
    const next = deferred<ServiceResult<Data>>(); api.fetcher.mockReturnValueOnce(next.promise);
    visibility.mockReturnValue('visible');
    await act(async () => document.dispatchEvent(new Event('visibilitychange')));
    expect(visible()).toBe('');
    expect(api.confirm).toHaveBeenCalledTimes(2);
    await act(async () => next.resolve({ ok: true, data: { label: 'Nach Rückkehr bestätigt' } }));
    expect(visible()).toBe('Nach Rückkehr bestätigt');
  });

  it('rechecks server rights on window focus and cannot reuse a revoked previous snapshot', async () => {
    await render();
    api.confirm.mockResolvedValue({ ok: false, error: 'Zugriff inzwischen entzogen.' });
    await act(async () => window.dispatchEvent(new Event('focus')));
    expect(visible()).toBe('');
    expect(api.confirm).toHaveBeenCalledTimes(2);
    expect(api.fetcher).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain('Zugriff inzwischen entzogen.');
  });

  it('does not dispatch a retained refresh after the consuming page unmounts', async () => {
    await render();
    const oldRefresh = query.refresh;
    await act(async () => root.unmount());
    root = createRoot(host);
    await act(async () => oldRefresh());
    expect(api.fetcher).toHaveBeenCalledTimes(1);
    expect(api.confirm).toHaveBeenCalledTimes(1);
  });
});
