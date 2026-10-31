// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ actor: { clientId: 'client-a', actorId: 'account-a', roleKey: 'client_portal', isLinkedReady: true, isResolvingClientLink: false }, fetch: vi.fn() }));
vi.mock('react-native', () => ({ Platform: { OS: 'android' }, AppState: { addEventListener: () => ({ remove() {} }) } }));
vi.mock('@/lib/services/queryTimeout', () => ({ withServiceQueryTimeout: (promise: unknown) => promise, NATIVE_SERVICE_QUERY_TIMEOUT_MS: 30000 }));
vi.mock('@/hooks/core/useLiveRefresh', () => ({ DEFAULT_LIVE_POLL_MS: 30000, useLiveRefresh: () => ({ isLiveConnected: false }) }));
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
// Compile the actual route, retaining the exact import IDs (including Expo
// product-workflow aliases). Only transport and presentation hosts are inert.
const code = buildSync({ entryPoints: ['app/portal/client/budget/index.tsx'], bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', external: ['*'] }).outputFiles[0].text;
const require = createRequire(import.meta.url), compiled = { exports: {} as { default: React.ComponentType } };
const Host = ({ children }: any) => <div>{children}</div>;
new Function('require', 'module', 'exports', code)((id: string) => {
  if (id === 'react/jsx-runtime') return require('react/jsx-runtime');
  if (id === 'react-native') return { View: Host, Text: Host, StyleSheet: { create: (styles: unknown) => styles } };
  if (id.includes('/ClientBudgetVisualCards')) return { ClientBudgetVisualCards: ({ models }: any) => <div>{models.map((row: any) => row.title).join(',')}</div> };
  if (id.includes('/PortalTabScreen')) return { PortalTabScreen: Host };
  if (id === '@/components/ui') return { ErrorState: ({ title, message }: any) => <div>{title}{message}</div>, LoadingState: ({ message }: any) => <div>{message}</div>, EmptyState: ({ title }: any) => <div>{title}</div> };
  if (id.includes('/auroraGlass')) return { useAuroraAdaptiveText: () => ({ muted: '#445566', primary: '#112233' }) };
  if (id.includes('/spacing')) return { careSpacing: { sm: 8, md: 12 } };
  if (id === '@/hooks/core/useAsyncQuery') return { useAsyncQuery };
  if (id === '@/hooks/usePortalActor') return { usePortalActor: () => f.actor };
  if (id === '@/hooks/useTenantId') return { useServiceTenantId: () => 'tenant-a' };
  if (id === '@/lib/portal/assist/portalBudgetService') return { fetchPortalBudgetVisuals: f.fetch };
  if (id === '@/hooks/useClientPortalSettings') return { useClientPortalSettings: () => ({ settings: {}, loading: false, error: null }) };
  if (id === '@/lib/client/clientPortalSettingsService') return { canClientPortalSeeFeature: () => true };
  if (id === '@/components/portal/ClientPortalGuide') return { ClientPortalGuide: ({ title, message }: any) => <div>{title}{message}</div> };
  throw Error('Unexpected budget route dependency: ' + id);
}, compiled, compiled.exports);
const Route = compiled.exports.default;
let root: Root, host: HTMLDivElement;
const render = async () => { await act(async () => root.render(<Route />)); };
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); vi.clearAllMocks(); Object.assign(f.actor, { clientId: 'client-a', actorId: 'account-a', roleKey: 'client_portal', isLinkedReady: true }); f.fetch.mockResolvedValue({ ok: true, data: [{ title: 'Synthetischer Saldo 123,45' }] }); host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
describe('actual client budget direct route', () => {
  it('does not bypass individual family limits through an otherwise released budget deep link', async () => {
    f.actor.roleKey = 'family_portal'; await render();
    expect(f.fetch).not.toHaveBeenCalled(); expect(host.textContent).toContain('Budget noch nicht freigegeben'); expect(host.textContent).not.toContain('Synthetischer Saldo 123,45');
  });
  it('retains exact client reads and clears their data if the held route switches to a family role', async () => {
    await render(); expect(f.fetch).toHaveBeenCalledExactlyOnceWith('tenant-a', 'client-a'); expect(host.textContent).toContain('Synthetischer Saldo 123,45');
    f.actor.roleKey = 'family_portal'; await render(); expect(f.fetch).toHaveBeenCalledOnce(); expect(host.textContent).not.toContain('Synthetischer Saldo 123,45');
  });
  it('withholds the previous account data while the same-client read for another account is pending', async () => {
    await render(); f.fetch.mockReturnValueOnce(new Promise(() => {})); f.actor.actorId = 'account-b'; await render();
    expect(f.fetch).toHaveBeenCalledTimes(2); expect(host.textContent).not.toContain('Synthetischer Saldo 123,45');
  });
});
