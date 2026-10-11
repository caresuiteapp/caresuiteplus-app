// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePortalActor, type PortalActor } from '@/hooks/usePortalActor';
import { createVerifiedPortalEmployeeLink } from '@/lib/auth/verifiedPortalEmployeeLink';

const h = vi.hoisted(() => ({
  auth: {} as any, mode: 'supabase', offline: false, employee: vi.fn(), accountEmployee: vi.fn(), update: vi.fn(), name: vi.fn(),
}));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => h.auth }));
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => h.mode }));
vi.mock('@/hooks/useConnectivity', () => ({ useConnectivity: () => ({ isOffline: h.offline }) }));
vi.mock('@/lib/supabase', () => ({ getSession: vi.fn() }));
vi.mock('@/lib/portal/resolvePortalClientLink', () => ({ fetchPortalClientIdByAccessAccount: vi.fn(), fetchPortalClientIdForAuthUser: vi.fn() }));
vi.mock('@/lib/portal/resolvePortalEmployeeLink', () => ({ fetchPortalEmployeeIdForAuthUser: h.employee, fetchPortalEmployeeIdByAccessAccount: h.accountEmployee,
  resolvePortalEmployeeLinkForAuthUser: async (tenantId: string) => {
    const employeeId = await h.employee(tenantId);
    return employeeId ? { status: 'verified', employeeId, authUserId: h.auth.user?.id } : { status: 'denied' };
  },
}));
vi.mock('@/lib/portal/clientPortalDisplayName', () => ({ fetchClientPortalDisplayName: vi.fn(), isPortalUsernameLabel: () => false }));
vi.mock('@/lib/portal/employeePortalDisplayName', () => ({ fetchEmployeePortalDisplayName: h.name }));
vi.mock('@/lib/auth/userdisplayname', () => ({ getPortalDisplayName: () => 'Mitarbeiter' }));

let actor: PortalActor;
let root: Root;
let host: HTMLDivElement;
function Probe() { actor = usePortalActor(); return <span>{actor.employeeId ?? 'kein Mitarbeiter'}</span>; }
async function render() { await act(async () => root.render(<Probe />)); }
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}
beforeEach(() => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks(); h.mode = 'supabase'; h.offline = false;
  h.auth = {
    user: { id: 'auth-a', roleKey: 'employee_portal' },
    profile: { id: 'profile-a', tenantId: 'tenant-a', roleKey: 'employee_portal', employeeId: 'stale-profile-employee' },
    portalSession: { accountId: 'account-a', tenantId: 'tenant-a', roleKey: 'employee_portal', employeeId: 'stale-session-employee' },
    updatePortalSession: h.update,
  };
  h.employee.mockResolvedValue('canonical-employee');
  h.update.mockResolvedValue(undefined); h.name.mockResolvedValue(null);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); });

function verifiedCache() {
  h.auth.session = { user: h.auth.user, accessToken: 'header.payload.signature-a', expiresAt: Date.now() + 3_600_000 };
  h.auth.portalSession = { ...h.auth.portalSession, loginType: 'employee_portal', sessionToken: 'test-only-opaque-session', expiresAt: new Date(Date.now() + 7_200_000).toISOString(), employeeId: 'canonical-employee' };
  h.auth.portalSession.employeeLinkVerification = createVerifiedPortalEmployeeLink('canonical-employee', h.auth.portalSession, h.auth.user, h.auth.session);
}

describe('live employee portal actor identity', () => {
  it('withholds cached employee ids until the canonical authenticated link resolves', async () => {
    const pending = deferred<string | null>(); h.employee.mockReturnValue(pending.promise);
    await render();
    expect(actor.employeeId).toBeNull(); expect(actor.isLinkedReady).toBe(false);
    expect(actor.isResolvingEmployeeLink).toBe(true);
    expect(h.name).not.toHaveBeenCalled();
    await act(async () => pending.resolve('canonical-employee'));
    expect(actor.employeeId).toBe('canonical-employee'); expect(actor.isLinkedReady).toBe(true);
    expect(h.employee).toHaveBeenCalledWith('tenant-a');
    expect(h.accountEmployee).not.toHaveBeenCalled();
    expect(h.update).toHaveBeenCalledWith({ employeeId: 'canonical-employee' });
  });

  it.each([null, new Error('network unavailable')])('does not fall back to stale ids when canonical resolution fails: %s', async (failure) => {
    if (failure instanceof Error) h.employee.mockRejectedValue(failure); else h.employee.mockResolvedValue(failure);
    await render();
    expect(actor.employeeId).toBeNull(); expect(actor.isLinkedReady).toBe(false);
    expect(actor.isResolvingEmployeeLink).toBe(false); expect(h.update).not.toHaveBeenCalled();
  });

  it('ignores a late link from the old authenticated account after a switch', async () => {
    const old = deferred<string | null>(); h.employee.mockReturnValueOnce(old.promise).mockResolvedValue('employee-b');
    await render();
    h.auth = { ...h.auth, user: { id: 'auth-b' },
      profile: { id: 'profile-b', tenantId: 'tenant-b', roleKey: 'employee_portal', employeeId: 'stale-b' },
      portalSession: { accountId: 'account-b', tenantId: 'tenant-b', roleKey: 'employee_portal', employeeId: 'stale-b' },
    };
    await render(); expect(actor.employeeId).toBe('employee-b');
    await act(async () => old.resolve('employee-a'));
    expect(actor.employeeId).toBe('employee-b');
    expect(h.update.mock.calls).toEqual([[{ employeeId: 'employee-b' }]]);
  });

  it.each(['caregiver', 'nurse'])('verifies the own employee for the supported %s role', async (roleKey) => {
    h.auth.portalSession = null;
    h.auth.profile = { ...h.auth.profile, roleKey };
    await render(); expect(actor.employeeId).toBe('canonical-employee'); expect(actor.isLinkedReady).toBe(true);
    expect(h.employee).toHaveBeenCalledWith('tenant-a');
  });

  it('does not expose a stale employee id to a client portal role', async () => {
    h.auth.portalSession = { ...h.auth.portalSession, roleKey: 'client_portal', clientId: 'client-a' };
    await render(); expect(actor.employeeId).toBeNull(); expect(h.employee).not.toHaveBeenCalled();
  });

  it('keeps the local employee identity available in explicit demo mode', async () => {
    h.mode = 'demo'; await render();
    expect(actor.employeeId).toBe('stale-session-employee'); expect(actor.isLinkedReady).toBe(true);
    expect(h.employee).not.toHaveBeenCalled();
  });

  it('opens only previously server-verified cache identity in explicit offline read mode', async () => {
    verifiedCache(); h.offline = true; h.employee.mockResolvedValue(null);
    await render();
    expect(actor.employeeId).toBe('canonical-employee'); expect(actor.isLinkedReady).toBe(true);
    expect(actor.employeeLinkReadOnly).toBe(true);
    expect(actor.employeeLinkVerifiedAt).toBe(h.auth.portalSession.employeeLinkVerification.verifiedAt);
    expect(h.employee).not.toHaveBeenCalled(); expect(h.update).not.toHaveBeenCalled();
  });

  it('keeps a confirmed cache during boot network failure before connectivity reports offline', async () => {
    verifiedCache(); h.employee.mockRejectedValue(new Error('network unavailable'));
    await render(); expect(actor.employeeId).toBeNull(); expect(h.update).not.toHaveBeenCalled();
    h.offline = true; await render();
    expect(actor.employeeId).toBe('canonical-employee'); expect(actor.employeeLinkReadOnly).toBe(true);
  });

  it('removes an old offline verification after confirmed server denial', async () => {
    verifiedCache(); h.employee.mockResolvedValue(null);
    h.update.mockImplementation(async (patch) => { h.auth.portalSession = { ...h.auth.portalSession, ...patch }; });
    await render(); expect(h.update).toHaveBeenCalledWith({ employeeLinkVerification: null });
    h.offline = true; await render();
    expect(actor.employeeId).toBeNull(); expect(actor.isLinkedReady).toBe(false);
  });

  it('revalidates online and replaces a reassigned cached employee with the server identity', async () => {
    verifiedCache(); h.offline = true; await render(); expect(actor.employeeId).toBe('canonical-employee');
    h.employee.mockResolvedValue('reassigned-employee');
    h.update.mockImplementation(async (patch) => { h.auth.portalSession = { ...h.auth.portalSession, ...patch }; });
    h.offline = false; await render();
    expect(actor.employeeId).toBe('reassigned-employee'); expect(actor.employeeLinkReadOnly).toBe(false);
    expect(h.auth.portalSession.employeeLinkVerification.employeeId).toBe('reassigned-employee');
  });

  it('does not use a cached identity after the session signature changes', async () => {
    verifiedCache(); h.offline = true;
    h.auth.session = { ...h.auth.session, accessToken: 'header.payload.signature-b' };
    await render(); expect(actor.employeeId).toBeNull(); expect(actor.isLinkedReady).toBe(false);
  });

  it('withdraws a cached identity when its signed session expires while mounted', async () => {
    vi.useFakeTimers(); verifiedCache();
    h.auth.session.expiresAt = Date.now() + 1_000;
    h.auth.portalSession.employeeLinkVerification = createVerifiedPortalEmployeeLink('canonical-employee', h.auth.portalSession, h.auth.user, h.auth.session);
    h.offline = true; await render(); expect(actor.isLinkedReady).toBe(true);
    await act(async () => vi.advanceTimersByTimeAsync(1_000));
    expect(actor.employeeId).toBeNull(); expect(actor.isLinkedReady).toBe(false);
  });
});
