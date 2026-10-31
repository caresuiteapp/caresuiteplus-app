// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FamilyPortalAccessScope } from '@/lib/portal/familyPortalAccessScope';
const f = vi.hoisted(() => ({ auth: {} as any, family: vi.fn(), update: vi.fn() }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => f.auth }));
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
vi.mock('@/hooks/useConnectivity', () => ({ useConnectivity: () => ({ isOffline: false }) }));
vi.mock('@/lib/supabase', () => ({ getSession: vi.fn() }));
vi.mock('@/lib/portal/resolvePortalClientLink', () => ({ fetchPortalClientIdByAccessAccount: vi.fn(), fetchPortalClientIdForAuthUser: vi.fn() }));
vi.mock('@/lib/portal/resolvePortalEmployeeLink', () => ({ fetchPortalEmployeeIdForAuthUser: vi.fn(), fetchPortalEmployeeIdByAccessAccount: vi.fn(), resolvePortalEmployeeLinkForAuthUser: vi.fn() }));
vi.mock('@/lib/portal/resolveFamilyPortalAccess', () => ({ fetchCurrentFamilyPortalAccessScope: f.family }));
vi.mock('@/lib/portal/clientPortalDisplayName', () => ({ fetchClientPortalDisplayName: async () => 'Freigegebene Person', isPortalUsernameLabel: () => false }));
vi.mock('@/lib/portal/employeePortalDisplayName', () => ({ fetchEmployeePortalDisplayName: vi.fn() }));
vi.mock('@/lib/auth/userdisplayname', () => ({ getPortalDisplayName: () => 'Mein Zugang' }));
import { usePortalActor, type PortalActor } from '@/hooks/usePortalActor';
import { familyPortalAllows, familyPortalScopeIsCurrent } from '@/lib/portal/familyPortalAccessScope';

const tenant = '10000000-0000-4000-8000-000000000001', account = '20000000-0000-4000-8000-000000000001', client = '30000000-0000-4000-8000-000000000001';
const start = Date.parse('2026-10-26T12:00:00.000Z');
const micro = (time: number) => new Date(time).toISOString().replace(/(\.\d{3})Z$/, '$1000Z');
const scope = (expiresAt: string | null): FamilyPortalAccessScope => ({ tenantId: tenant, accountId: account, clientId: client, relativeContactId: '40000000-0000-4000-8000-000000000001', validFrom: micro(start - 1000), expiresAt, source: 'authenticated_family_portal_scope', permissions: { documents: true } as FamilyPortalAccessScope['permissions'] });
let actor!: PortalActor, root: Root, host: HTMLDivElement;
function Probe() { actor = usePortalActor(); return <div>{actor.clientId}:{actor.familyAccess?.permissions.documents ? 'documents' : ''}</div>; }
const render = async () => { await act(async () => root.render(<Probe />)); };
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(start);
  f.auth = { user: { id: 'auth-a', roleKey: 'family_portal' }, profile: null, portalSession: { tenantId: tenant, accountId: account, clientId: client, roleKey: 'family_portal', displayName: 'Mein Zugang' }, updatePortalSession: f.update };
  f.family.mockResolvedValue(scope(micro(start + 1000))); f.update.mockResolvedValue(undefined);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); });
describe('retained authenticated family scope', () => {
  it('withdraws scope and linked client exactly at expiry without navigation or a service refresh', async () => {
    await render(); expect(actor.isLinkedReady).toBe(true); expect(actor.clientId).toBe(client);
    await act(async () => vi.advanceTimersByTimeAsync(999)); expect(actor.isLinkedReady).toBe(true);
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(actor.familyAccess).toBeNull(); expect(actor.clientId).toBeNull(); expect(actor.isLinkedReady).toBe(false);
    expect(f.family).toHaveBeenCalledTimes(1);
  });
  it('cancels the old expiry timer when the authenticated identity changes', async () => {
    await render();
    f.auth = { ...f.auth, user: { id: 'auth-b', roleKey: 'family_portal' }, portalSession: { ...f.auth.portalSession, accountId: '20000000-0000-4000-8000-000000000002' } };
    f.family.mockResolvedValue({ ...scope(micro(start + 5000)), accountId: f.auth.portalSession.accountId });
    await render(); await act(async () => vi.advanceTimersByTimeAsync(1000));
    expect(actor.familyAccess?.accountId).toBe(f.auth.portalSession.accountId); expect(actor.isLinkedReady).toBe(true);
  });
  it('ends link resolution after transport rejection rather than leaving an endless loader', async () => {
    f.family.mockRejectedValueOnce(new Error('network unavailable'));
    await render(); expect(actor.isResolvingClientLink).toBe(false); expect(actor.isLinkedReady).toBe(false); expect(actor.familyAccess).toBeNull();
  });
  it('discards an old scope if auth changes while the account and tenant identifiers remain the same', async () => {
    let finish!: (value: FamilyPortalAccessScope) => void;
    f.family.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    await render(); expect(actor.isResolvingClientLink).toBe(true);
    f.auth = { ...f.auth, user: { id: 'auth-b', roleKey: 'family_portal' } };
    f.family.mockResolvedValueOnce({ ...scope(null), clientId: '30000000-0000-4000-8000-000000000002' });
    await render(); await act(async () => finish(scope(null)));
    expect(actor.clientId).toBe('30000000-0000-4000-8000-000000000002');
  });
  it.each([
    { validFrom: micro(start + 1), expiresAt: null },
    { validFrom: 'invalid', expiresAt: null },
    { validFrom: micro(start - 1), expiresAt: micro(start) },
    { validFrom: micro(start - 1), expiresAt: 'invalid' },
  ])('denies capability use with a future, invalid or expired time boundary: %j', (boundary) => {
    const value = { ...scope(null), ...boundary };
    expect(familyPortalScopeIsCurrent(value, start)).toBe(false); expect(familyPortalAllows(value, 'documents', start)).toBe(false);
  });
});
