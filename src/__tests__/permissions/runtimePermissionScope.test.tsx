// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ auth: { profile: { id: 'profile-a', roleKey: 'business_admin' }, user: { id: 'user-a' }, portalSession: null as any, session: null as any }, tenant: 'tenant-a', demo: false, fetch: vi.fn() }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => f.auth }));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => f.tenant }));
vi.mock('@/lib/supabase/config', () => ({ isDemoMode: () => f.demo }));
vi.mock('@/lib/supabase/permissionRepository', () => ({ fetchRuntimePermissions: (...args: unknown[]) => f.fetch(...args) }));
vi.mock('@/lib/modules/moduleAccessService', () => ({ hasEffectiveModuleGateAccess: () => true }));
import { usePermissions } from '@/hooks/usePermissions';
const deferred = () => { let resolve!: (value: any) => void, reject!: (error: Error) => void; const promise = new Promise<any>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
let root: Root, host: HTMLDivElement, latest: ReturnType<typeof usePermissions>;
function Probe() { latest = usePermissions(); return <span>{String(latest.can('office.clients.edit'))}</span>; }
const render = () => act(async () => root.render(<Probe />));
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); f.auth = { profile: { id: 'profile-a', roleKey: 'business_admin' }, user: { id: 'user-a' }, portalSession: null, session: null }; f.tenant = 'tenant-a'; f.demo = false; f.fetch.mockReset(); host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
describe('actual shared permission hook identity boundaries', () => {
  it('does not grant the static admin list before live authorization completes', async () => { const read = deferred(); f.fetch.mockReturnValue(read.promise); await render(); expect(latest.can('office.clients.edit')).toBe(false); await act(async () => read.resolve(['office.clients.edit'])); expect(latest.can('office.clients.edit')).toBe(true); });
  it.each(['tenant', 'actor', 'portal', 'session'] as const)('clears prior rights immediately on a %s change and rejects the old reply', async change => {
    const old = deferred(), current = deferred(); f.fetch.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise); await render();
    if (change === 'tenant') f.tenant = 'tenant-b';
    if (change === 'actor') f.auth = { ...f.auth, user: { id: 'user-b' }, profile: { ...f.auth.profile, id: 'profile-b' } };
    if (change === 'session') f.auth = { ...f.auth, session: { accessToken: 'test.header.new-signature', expiresAt: 1000 } };
    if (change === 'portal') f.auth = { ...f.auth, portalSession: { roleKey: 'employee_portal', accountId: 'account-b', sessionToken: 'synthetic-session' } };
    await render(); await act(async () => current.resolve([])); await act(async () => old.resolve(['office.clients.edit'])); expect(latest.can('office.clients.edit')).toBe(false); expect(f.fetch).toHaveBeenCalledTimes(2);
  });
  it('does not retain the previous actor permissions while a new read is pending', async () => { f.fetch.mockResolvedValueOnce(['office.clients.edit']); await render(); expect(latest.can('office.clients.edit')).toBe(true); f.fetch.mockReturnValue(deferred().promise); f.auth = { ...f.auth, user: { id: 'other' } }; await render(); expect(latest.can('office.clients.edit')).toBe(false); });
  it('fails closed when the current read rejects and ignores completions after unmount', async () => { const read = deferred(); f.fetch.mockReturnValue(read.promise); await render(); await act(async () => read.reject(Error('offline'))); expect(latest.permissions).toEqual([]); const late = deferred(); f.fetch.mockReturnValue(late.promise); f.tenant = 'next'; await render(); await act(async () => root.render(null)); await act(async () => late.resolve(['office.clients.edit'])); expect(host.textContent).toBe(''); });
  it('retains the existing explicit demo-role behavior', async () => { f.demo = true; await render(); expect(latest.can('office.clients.edit')).toBe(true); expect(f.fetch).not.toHaveBeenCalled(); });
});
