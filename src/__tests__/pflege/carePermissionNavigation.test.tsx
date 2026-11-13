// @vitest-environment happy-dom
import { act, StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CareRuntimePermissionsProvider,
  useCareRuntimePermissions,
} from '@/hooks/pflege/useCareRuntimePermissions.web';
import { CarePermissionStatus } from '@/screens/pflege/CarePermissionStatus.web';
import type { CarePermissionAuth } from '@/lib/permissions/carePermissionOwner.web';
import type { PermissionKey } from '@/types/permissions';

const mocks = vi.hoisted(() => ({
  auth: null as unknown as CarePermissionAuth,
  read: vi.fn(),
  getSession: vi.fn(),
}));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => mocks.auth.profile?.tenantId }));
vi.mock('@/lib/supabase', () => ({ getSession: mocks.getSession }));
vi.mock('@/lib/supabase/config', () => ({ isDemoMode: () => false }));
vi.mock('@/lib/modules/moduleAccessService', () => ({ hasEffectiveModuleGateAccess: () => true }));
vi.mock('@/lib/permissions/confirmedCarePermissions.web', () => ({ fetchConfirmedCarePermissions: mocks.read }));
vi.mock('@/components/ui', () => ({
  LoadingState: ({ presentation }: { presentation: string }) => <p role="status" data-presentation={presentation}>Pflegeberechtigungen werden geprüft</p>,
  ErrorState: ({ message, onRetry }: { message: string; onRetry?: () => void }) => (
    <div role="alert">{message}{onRetry && <button onClick={onRetry}>Erneut versuchen</button>}</div>
  ),
}));

const tenant = '00000000-0000-4000-8000-000000000001';
const profile = '00000000-0000-4000-8000-000000000002';
const account = '00000000-0000-4000-8000-000000000003';
const right: PermissionKey = 'pflege.plans.view';
const otherRight: PermissionKey = 'pflege.vitals.view';
type Access = ReturnType<typeof useCareRuntimePermissions>;

function pendingRead() {
  let resolve!: (permissions: PermissionKey[]) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<PermissionKey[]>((success, failure) => {
    resolve = success;
    reject = failure;
  });
  return { promise, resolve, reject };
}

function makeAuth(token = 'original-session', expiresAt = Date.now() + 60_000): CarePermissionAuth {
  const user = { id: account, roleKey: 'business_admin' };
  return {
    authReady: true, isAuthenticated: true, isLoading: false, profileBootstrapError: null,
    profile: { id: profile, tenantId: tenant, roleKey: 'business_admin' },
    user, session: { user, accessToken: token, expiresAt }, portalSession: null,
  };
}

describe('Pflegeberechtigungen innerhalb der Modulnavigation', () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let access: Access;
  let subAccess: Access;

  function Subpage() {
    subAccess = useCareRuntimePermissions();
    return <span>{subAccess.can(right) ? 'Planliste bereit' : null}</span>;
  }

  function Screen({ label }: { label: string }) {
    access = useCareRuntimePermissions();
    return access.can(right) ? <>{label}<Subpage /></> : <CarePermissionStatus state={access} />;
  }

  const render = (label: string, providerKey = 'module', wrap: (child: ReactNode) => ReactNode = child => child) =>
    act(async () => root.render(wrap(
      <CareRuntimePermissionsProvider key={providerKey}><Screen key={label} label={label} /></CareRuntimePermissionsProvider>,
    )));

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    mocks.read.mockReset();
    mocks.getSession.mockReset();
    mocks.auth = makeAuth();
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it('reuses the confirmed rights during navigation and checks them anew on a full reload', async () => {
    const initial = pendingRead();
    mocks.read.mockReturnValueOnce(initial.promise).mockResolvedValue([right]);
    await render('Pflegepläne');
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(host.querySelector('[role="status"]')?.getAttribute('data-presentation')).toBe('inline');
    await act(async () => initial.resolve([right]));
    expect(host.textContent).toContain('PflegeplänePlanliste bereit');
    expect(mocks.read).toHaveBeenCalledOnce();
    const oldScreen = access;
    const oldSubpage = subAccess;
    await render('Weitere Pflegeansicht');
    expect(host.textContent).toContain('Weitere PflegeansichtPlanliste bereit');
    expect(mocks.read).toHaveBeenCalledOnce();
    expect(oldScreen.can(right)).toBe(false);
    expect(oldSubpage.can(right)).toBe(false);
    await render('Direkter Unterseitenaufruf', 'reloaded');
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(host.textContent).toContain('Direkter UnterseitenaufrufPlanliste bereit');
    expect(mocks.read).toHaveBeenCalledTimes(2);
  });

  it('discards superseded rights on refresh and waits for the new confirmation before showing a denial', async () => {
    const refreshed = pendingRead();
    mocks.read.mockResolvedValueOnce([right]).mockReturnValueOnce(refreshed.promise);
    await render('Pflegepläne');
    const previous = access;
    mocks.auth = makeAuth('renewed-session');
    await render('Pflegepläne');
    expect(previous.can(right)).toBe(false);
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(host.querySelector('[role="status"]')).not.toBeNull();
    await act(async () => refreshed.resolve([otherRight]));
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('fehlt die Leseberechtigung');
    expect(host.querySelector('button')).toBeNull();
    expect(access.can(otherRight)).toBe(true);
    expect(previous.can(otherRight)).toBe(false);
  });

  it('retries a failed shared permission check from the current screen', async () => {
    mocks.read.mockRejectedValueOnce(new Error('connection lost')).mockResolvedValueOnce([right]);
    await render('Pflegepläne');
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('konnten nicht bestätigt werden');
    await act(async () => host.querySelector('button')?.click());
    expect(host.textContent).toContain('PflegeplänePlanliste bereit');
    expect(mocks.read).toHaveBeenCalledTimes(2);
  });

  it('requests session recovery once and waits for the published session', async () => {
    const renewed = makeAuth('renewed-session');
    mocks.auth = makeAuth('expired-session', Date.now() - 1);
    mocks.getSession.mockResolvedValue({ ok: true, data: { user: renewed.user, access_token: renewed.session?.accessToken } });
    mocks.read.mockResolvedValue([right]);
    await render('Pflegepläne');
    expect(mocks.getSession).toHaveBeenCalledOnce();
    expect(mocks.read).not.toHaveBeenCalled();
    expect(host.querySelector('[role="alert"]')).toBeNull();
    mocks.auth = renewed;
    await render('Pflegepläne');
    expect(host.textContent).toContain('PflegeplänePlanliste bereit');
    expect(mocks.read).toHaveBeenCalledOnce();
  });

  it('discards the first effect result if React replays the provider in StrictMode', async () => {
    const initial = pendingRead(), replacement = pendingRead();
    mocks.read.mockReturnValueOnce(initial.promise).mockReturnValueOnce(replacement.promise);
    await render('Pflegepläne', 'module', child => <StrictMode>{child}</StrictMode>);
    await act(async () => initial.resolve([right]));
    expect(access.can(right)).toBe(false);
    expect(host.querySelector('[role="alert"]')).toBeNull();
    await act(async () => replacement.resolve([right]));
    expect(host.textContent).toContain('PflegeplänePlanliste bereit');
  });
});
