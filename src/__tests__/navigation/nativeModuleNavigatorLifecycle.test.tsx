// @vitest-environment happy-dom
import React, { act, useEffect, useState, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContextValue } from '@/lib/auth/context';
import { buildSync } from 'esbuild';
import * as jsxRuntime from 'react/jsx-runtime';

const state = vi.hoisted(() => ({
  pathname: '/business',
  mounts: 0,
  unmounts: 0,
  nestedMounts: 0,
  focused: true,
  businessEffects: [] as (string | null | undefined)[],
  platform: 'android',
  router: { push: vi.fn(), replace: vi.fn() },
}));
vi.mock('react-native', () => ({ Platform: { get OS() { return state.platform; } } }));
vi.mock('expo-router', () => ({
  usePathname: () => state.pathname,
  useRouter: () => state.router,
  useIsFocused: () => state.focused,
  Redirect: () => null,
  // The navigator boundary owns state independently of the URL, as the real
  // native navigator does. Its lifecycle must survive surrounding chrome.
  Stack: ({ screenLayout }: { screenLayout?: (props: { children: ReactNode }) => ReactNode }) => {
    const [instance] = useState(() => ++state.mounts);
    const [navigationMemory, setNavigationMemory] = useState('initial');
    useEffect(() => () => { state.unmounts += 1; }, []);
    const scene = <div data-navigator-instance={instance}>
      <span data-testid="destination">{state.pathname}</span>
      <BusinessChildProbe />
      <NestedNavigatorProbe />
      <button data-testid="retain-outer-state" onClick={() => setNavigationMemory('retained')}>{navigationMemory}</button>
    </div>;
    return screenLayout ? screenLayout({ children: scene }) : scene;
  },
}));
vi.mock('@/lib/auth', async () => ({
  RequireAuth: (await import('@/lib/auth/RequireAuth')).RequireAuth,
  RequireRole: (await import('@/lib/auth/RequireRole')).RequireRole,
}));
vi.mock('@/lib/navigation', async () => import('@/lib/navigation/redirects'));
vi.mock('@/lib/supabase', () => ({ getSession: vi.fn(async () => ({ ok: true, data: null })) }));
vi.mock('@/components/ui', () => ({
  LoadingState: ({ message }: { message: string }) => <span>{message}</span>,
  ErrorState: ({ message }: { message: string }) => <span>{message}</span>,
}));
vi.mock('@/design/tokens/portalPremium', () => ({ PortalPremiumProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock('@/liquid-command/components/LiquidPrimitives', () => ({
  LiquidVisualModeProvider: ({ children }: { children: ReactNode }) => children,
  LiquidBackdrop: ({ children }: { children: ReactNode }) => children,
  LiquidState: ({ title }: { title: string }) => <span>{title}</span>,
}));
vi.mock('@/liquid-command/shell/LiquidCommandShell', () => ({
  LiquidCommandShell: ({ children }: { children: ReactNode }) => <main data-testid="workspace-chrome">{children}</main>,
}));
vi.mock('@/components/assist/DeferredSignatureApprovalPopup', () => ({ DeferredSignatureApprovalPopup: () => null }));

import { AuthContext } from '@/lib/auth/context';
import { RequireRole } from '@/lib/auth/RequireRole';
import { LiquidProductAccessGuard } from '@/liquid-command/guards/LiquidProductAccessGuard';
import { getRouteByPath } from '@/lib/navigation/routes';
import { APP_ROUTES } from '@/lib/navigation/routes';
import { liquidPortalRoots, liquidPortalLoginRoutes } from '@/liquid-command/navigation/portalCatalog';
import { webScaledFontMetric } from '@/design/web/webFontSize';
import { PortalViewportContext } from '@/lib/portal/portalViewportContext';
import BusinessLayout from '../../../app/business/_layout';
import OfficeLayout from '../../../app/office/_layout';
import AssistLayout from '../../../app/assist/_layout';
import PflegeLayout from '../../../app/pflege/_layout';
import StationaerLayout from '../../../app/stationaer/_layout';
import BeratungLayout from '../../../app/beratung/_layout';
import AkademieLayout from '../../../app/akademie/_layout';
import MedicalLayout from '../../../app/medical/_layout';
import InsightLayout from '../../../app/insight/_layout';

// Keep portal chrome inert while reading the real layout's policy binding.
// The resulting RequireRole element is rendered with the actual guard below.
const portalSource = buildSync({ entryPoints: ['src/liquid-command/shell/LiquidPortalRouteLayout.tsx'], bundle: false, write: false, format: 'cjs', jsx: 'automatic' }).outputFiles[0].text;
const portalModule = { exports: {} as any };
new Function('require', 'module', 'exports', portalSource)((id: string) => {
  if (id === 'react') return React;
  if (id === 'react/jsx-runtime') return jsxRuntime;
  if (id === 'react-native') return { Platform: { get OS() { return state.platform; } }, StyleSheet: { create: (styles: unknown) => styles } };
  if (id === '@/lib/auth') return { useAuth: () => auth, RequireRole, RequireAuth: ({ children }: any) => children, RequireEmployeePasswordSetup: ({ children }: any) => children };
  if (id === '../navigation/portalCatalog') return { liquidPortalRoots, liquidPortalLoginRoutes };
  if (id === '../foundation/tokens') return { liquidColors: {}, liquidLayers: {}, liquidRadius: {} };
  if (id === '@/design/withCareSuiteTypography') return { withCareSuiteTypography: (styles: unknown) => styles };
  if (id === '@/design/web/webFontSize') return { webScaledFontMetric };
  if (id === '@/lib/portal/portalViewportContext') return { PortalViewportContext };
  return {};
}, portalModule, portalModule.exports);
function portalRoleElement(kind: 'employee' | 'client'): React.ReactElement<{ ownerPath?: string; children?: ReactNode }> {
  const tree = portalModule.exports.LiquidPortalRouteLayout({ kind });
  function find(value: ReactNode): any {
    if (!React.isValidElement<{ children?: ReactNode }>(value)) return null;
    if (value.type === RequireRole) return value;
    for (const child of React.Children.toArray(value.props.children)) { const found = find(child); if (found) return found; }
    return null;
  }
  const guard = find(tree); expect(guard).toBeTruthy(); return guard;
}
const owners = [
  { path: '/office', Layout: OfficeLayout }, { path: '/assist', Layout: AssistLayout },
  { path: '/pflege', Layout: PflegeLayout }, { path: '/stationaer', Layout: StationaerLayout },
  { path: '/beratung', Layout: BeratungLayout }, { path: '/akademie', Layout: AkademieLayout },
  { path: '/medical', Layout: MedicalLayout }, { path: '/insight', Layout: InsightLayout },
];

function BusinessChildProbe() {
  const identity = React.useContext(AuthContext)!;
  const role = identity.portalSession?.roleKey ?? identity.profile?.roleKey;
  useEffect(() => { state.businessEffects.push(role); }, [role]);
  return <span data-testid="business-child">{role}</span>;
}

function NestedNavigatorProbe() {
  const [instance] = useState(() => ++state.nestedMounts);
  const [destination, setDestination] = useState('initial');
  return <div data-nested-instance={instance}>
    <span data-testid="nested-destination">{destination}</span>
    <button data-testid="choose-nested-destination" onClick={() => setDestination('chosen-page')}>Unternavigation ändern</button>
  </div>;
}

let host: HTMLDivElement;
let root: Root;
let auth: AuthContextValue;
const render = async () => {
  await act(async () => root.render(<AuthContext.Provider value={auth}><BusinessLayout /></AuthContext.Provider>));
};
const changePath = async (pathname: string) => { state.pathname = pathname; await render(); };
beforeEach(() => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks(); state.pathname = '/business'; state.mounts = 0; state.unmounts = 0; state.nestedMounts = 0;
  state.focused = true; state.businessEffects = [];
  state.platform = 'android';
  auth = {
    authReady: true, isInitialized: true, isLoading: false, isAuthenticated: true, authMode: 'demo',
    profile: { roleKey: 'business_admin', tenantId: 'tenant-1' }, user: null, session: null, portalSession: null,
    profileBootstrapError: null, retryProfileBootstrap: vi.fn(),
  } as unknown as AuthContextValue;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe('native module navigator lifecycle', () => {
  it('never lets a retained, unfocused module guard redirect the current page', async () => {
    state.pathname = '/pflege/klienten'; state.focused = false;
    const tree = <AuthContext.Provider value={auth}><LiquidProductAccessGuard><span data-testid="guard-child" /></LiquidProductAccessGuard></AuthContext.Provider>;
    await act(async () => root.render(tree));
    expect(state.router.replace).not.toHaveBeenCalled();
    expect(host.querySelector('[data-testid="guard-child"]')).toBeNull();
    state.focused = true; await act(async () => root.render(<AuthContext.Provider value={auth}><LiquidProductAccessGuard><span data-testid="guard-child" /></LiquidProductAccessGuard></AuthContext.Provider>));
    expect(state.router.replace).toHaveBeenCalledExactlyOnceWith('/business');
    expect(host.querySelector('[data-testid="guard-child"]')).toBeNull();
  });
  it.each(['/business/office/clients', '/business/office/employees', '/business/templates/documents-hub', '/business/integrations'])(
    'retains a nested navigator when leaving and returning to native desktop via %s', async destination => {
      await render();
      await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="choose-nested-destination"]')!.click());
      expect(host.querySelector('[data-testid="nested-destination"]')?.textContent).toBe('chosen-page');
      await changePath(destination);
      expect(host.querySelector('[data-testid="nested-destination"]')?.textContent).toBe('chosen-page');
      expect(state.nestedMounts).toBe(1);
      await changePath('/business');
      expect(host.querySelector('[data-testid="nested-destination"]')?.textContent).toBe('chosen-page');
      expect(state.nestedMounts).toBe(1);
    },
  );
  it.each([...owners.map(owner => owner.path), '/business', ...Object.values(liquidPortalRoots)])('preserves every explicitly allowed descendant role of owner %s', owner => {
    const allowed = getRouteByPath(owner)?.allowedRoles;
    expect(allowed?.length).toBeGreaterThan(0);
    for (const route of APP_ROUTES.filter(route => route.path.startsWith(owner + '/'))) {
      for (const role of route.allowedRoles ?? []) expect(allowed, route.path + ': ' + role).toContain(role);
    }
  });
  it.each(owners)('blocks a retained $path workspace for a new portal identity using its own registry owner', async ({ path, Layout }) => {
    const ownerPath = Layout().props.nativeRoleOwnerPath;
    expect(ownerPath).toBe(path);
    state.pathname = '/portal/client'; state.focused = false;
    auth.profile = { roleKey: 'client_portal', tenantId: 'portal-tenant' } as NonNullable<AuthContextValue['profile']>;
    await act(async () => root.render(<AuthContext.Provider value={auth}><RequireRole ownerPath={ownerPath}><BusinessChildProbe /></RequireRole></AuthContext.Provider>));
    expect(host.querySelector('[data-testid="business-child"]')).toBeNull();
    expect(state.businessEffects).toEqual([]); expect(state.router.replace).not.toHaveBeenCalled();
  });
  it.each(owners.flatMap(owner => (getRouteByPath(owner.path)?.allowedRoles ?? []).map(role => ({ ...owner, role }))))('$path keeps its legitimate registry role $role', async ({ path, Layout, role }) => {
    const ownerPath = Layout().props.nativeRoleOwnerPath;
    state.pathname = path; auth.profile = { roleKey: role, tenantId: 'tenant-1' } as NonNullable<AuthContextValue['profile']>;
    await act(async () => root.render(<AuthContext.Provider value={auth}><RequireRole ownerPath={ownerPath}><BusinessChildProbe /></RequireRole></AuthContext.Provider>));
    expect(host.querySelector('[data-testid="business-child"]')?.textContent).toBe(role);
    expect(state.router.replace).not.toHaveBeenCalled();
  });
  it.each([
    { kind: 'employee' as const, from: 'employee_portal', to: 'client_portal', next: '/portal/client' },
    { kind: 'employee' as const, from: 'employee_portal', to: 'family_portal', next: '/portal/client/akademie' },
    { kind: 'client' as const, from: 'client_portal', to: 'employee_portal', next: '/portal/employee' },
  ])('does not mount retained $kind portal children after switching to $to', async ({ kind, from, to, next }) => {
    const roleElement = portalRoleElement(kind);
    expect(roleElement.props.ownerPath).toBe(liquidPortalRoots[kind]);
    auth.profile = { roleKey: from, tenantId: 'first-tenant' } as NonNullable<AuthContextValue['profile']>; state.pathname = liquidPortalRoots[kind];
    auth.portalSession = { roleKey: from, loginType: kind === 'employee' ? 'employee_portal' : 'client_portal', tenantId: 'first-tenant', accountId: 'first-account' } as NonNullable<AuthContextValue['portalSession']>;
    const view = () => <AuthContext.Provider value={auth}>{React.cloneElement(roleElement, {}, <BusinessChildProbe />)}</AuthContext.Provider>;
    await act(async () => root.render(view())); expect(state.businessEffects).toEqual([from]);
    state.focused = false; state.pathname = next;
    // Portal identity must win even while the previous profile is still in memory.
    auth.portalSession = { roleKey: to, loginType: to === 'employee_portal' ? 'employee_portal' : 'client_portal', tenantId: 'second-tenant', accountId: 'second-account' } as NonNullable<AuthContextValue['portalSession']>;
    await act(async () => root.render(view()));
    expect(host.querySelector('[data-testid="business-child"]')).toBeNull();
    expect(state.businessEffects).toEqual([from]); expect(state.router.replace).not.toHaveBeenCalled();
  });
  it.each((['employee', 'client'] as const).flatMap(kind => (getRouteByPath(liquidPortalRoots[kind])?.allowedRoles ?? []).map(role => ({ kind, role }))))('keeps the legitimate $kind portal role $role', async ({ kind, role }) => {
    state.pathname = liquidPortalRoots[kind]; auth.profile = { roleKey: role, tenantId: 'tenant-1' } as NonNullable<AuthContextValue['profile']>;
    await act(async () => root.render(<AuthContext.Provider value={auth}>{React.cloneElement(portalRoleElement(kind), {}, <BusinessChildProbe />)}</AuthContext.Provider>));
    expect(host.querySelector('[data-testid="business-child"]')?.textContent).toBe(role);
    expect(state.router.replace).not.toHaveBeenCalled();
  });
  it.each(['employee', 'client'] as const)('leaves Web $kind portal role policy bound to its existing pathname', kind => {
    state.platform = 'web'; expect(portalRoleElement(kind).props.ownerPath).toBeUndefined();
  });
  it.each(['employee_portal', 'client_portal'] as const)('blocks retained business children after logout and %s sign-in without redirecting the active portal', async role => {
    state.pathname = '/business/office/clients';
    await render();
    expect(state.businessEffects).toEqual(['business_admin']);
    auth = { ...auth, authReady: false, isAuthenticated: false, profile: null };
    state.focused = false;
    state.pathname = role === 'employee_portal' ? '/auth/employee-login' : '/auth/client-login';
    await render();
    expect(host.querySelector('[data-testid="business-child"]')).toBeNull();
    auth = { ...auth, authReady: true, isAuthenticated: true,
      profile: { roleKey: role, tenantId: 'portal-tenant' } as NonNullable<AuthContextValue['profile']>,
      portalSession: { roleKey: role, tenantId: 'portal-tenant', loginType: role, accountId: 'portal-account' } as NonNullable<AuthContextValue['portalSession']>,
    };
    state.pathname = role === 'employee_portal' ? '/portal/employee' : '/portal/client';
    await render();
    expect(host.querySelector('[data-testid="business-child"]')).toBeNull();
    expect(state.businessEffects).toEqual(['business_admin']);
    expect(state.mounts).toBe(1); expect(state.unmounts).toBe(1);
    expect(state.router.replace).not.toHaveBeenCalled();
  });

  it.each(getRouteByPath('/business')!.allowedRoles!)('keeps the registry-authorized business role %s available', async roleKey => {
    auth.profile = { roleKey, tenantId: 'tenant-1' } as NonNullable<AuthContextValue['profile']>;
    await render();
    expect(host.querySelector('[data-testid="business-child"]')?.textContent).toBe(roleKey);
    expect(state.router.replace).not.toHaveBeenCalled();
  });

  it('retains the stricter per-page role requirement inside the business owner boundary', async () => {
    state.pathname = '/business/connect';
    auth.profile = { roleKey: 'billing', tenantId: 'tenant-1' } as NonNullable<AuthContextValue['profile']>;
    await render();
    expect(state.mounts).toBe(0);
    expect(state.router.replace).toHaveBeenCalledExactlyOnceWith('/office');
  });

  it.each(['employee_portal', 'client_portal'] as const)('keeps the default unscoped portal guard behavior for %s', async roleKey => {
    state.pathname = roleKey === 'employee_portal' ? '/portal/employee' : '/portal/client';
    auth.profile = { roleKey, tenantId: 'tenant-1' } as NonNullable<AuthContextValue['profile']>;
    await act(async () => root.render(<AuthContext.Provider value={auth}><RequireRole><span>Portal content</span></RequireRole></AuthContext.Provider>));
    expect(host.textContent).toBe('Portal content');
    expect(state.router.replace).not.toHaveBeenCalled();
  });

  it('keeps one navigator through desktop, workflow pages and return navigation', async () => {
    await render();
    expect(host.querySelector('[data-testid="workspace-chrome"]')).toBeNull();
    const firstInstance = host.querySelector('[data-navigator-instance]')?.getAttribute('data-navigator-instance');
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="retain-outer-state"]')!.click());

    for (const pathname of ['/business/office/clients', '/business/office/documents', '/business']) {
      await changePath(pathname);
      expect(host.querySelector('[data-navigator-instance]')?.getAttribute('data-navigator-instance')).toBe(firstInstance);
      expect(host.querySelector('[data-testid="destination"]')?.textContent).toBe(pathname);
      expect(host.querySelector('[data-testid="retain-outer-state"]')?.textContent).toBe('retained');
      expect(host.querySelector('[data-testid="workspace-chrome"]')).toBeNull();
    }
    expect(state.mounts).toBe(1); expect(state.unmounts).toBe(0);
    expect(state.router.replace).not.toHaveBeenCalled();
  });

  it('still prevents an employee portal identity from mounting the business navigator', async () => {
    auth.profile = { roleKey: 'employee_portal', tenantId: 'tenant-1' } as NonNullable<AuthContextValue['profile']>;
    await render();
    expect(state.mounts).toBe(0);
    expect(state.router.replace).toHaveBeenCalledExactlyOnceWith('/portal/employee');
  });

  it('waits for authentication and role restoration without choosing an Office fallback', async () => {
    state.pathname = '/business/office/clients';
    auth.authReady = false; auth.profile = null;
    await render();
    expect(state.mounts).toBe(0);
    expect(state.router.replace).not.toHaveBeenCalled();
    auth.authReady = true;
    await render();
    expect(host.textContent).toBe('Berechtigungen werden geladen…');
    expect(state.mounts).toBe(0);
    expect(state.router.replace).not.toHaveBeenCalled();
    auth.profile = { roleKey: 'business_admin', tenantId: 'tenant-1' } as NonNullable<AuthContextValue['profile']>;
    await render();
    expect(host.querySelector('[data-testid="destination"]')?.textContent).toBe('/business/office/clients');
    expect(state.mounts).toBe(1);
    expect(state.router.replace).not.toHaveBeenCalled();
  });

  it.each(['/pflege/klienten', '/stationaer/bewohner'])('keeps the unreleased product lock for %s', async pathname => {
    await changePath(pathname);
    expect(state.mounts).toBe(0);
    expect(state.router.replace).toHaveBeenCalledExactlyOnceWith('/business');
  });
});
