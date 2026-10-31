// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ open: vi.fn(), replace: vi.fn(), signOut: vi.fn() }));
vi.mock('react-native', () => { const Host = ({ children, testID }: any) => <div data-testid={testID}>{children}</div>; return { View: Host, ScrollView: Host, Text: Host, Linking: { openURL: f.open }, StyleSheet: { create: (styles: unknown) => styles } }; });
vi.mock('expo-router', () => ({ useRouter: () => ({ replace: f.replace }) }));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => ({ signOut: f.signOut }) }));
vi.mock('@/components/ui', () => ({ PremiumButton: ({ title, onPress, loading }: any) => <button disabled={loading} onClick={onPress}>{title}</button>, ErrorState: ({ message }: any) => <div role="alert">{message}</div> }));
vi.mock('@/components/layout/HealthOSPageSurface', () => ({ HealthOSPageSurface: ({ children }: any) => <section>{children}</section> }));
vi.mock('@/design/tokens/portalPremium', () => ({ PortalPremiumProvider: ({ children }: any) => <div>{children}</div>, portalPremium: { accent: { blue: '#245A96' }, text: { primary: '#142B4C', secondary: '#445566' } } }));
import { NativeAcademyPortalEntry } from '@/screens/portal/NativeAcademyPortalEntry.native';
import { nativeSource } from '../../../scripts/native-source-adaptations.mjs';

// Exercise the exact adaptation used by the existing native generator. Any
// dependency on the Academy workspace here makes the contract fail.
const nativeEntry = nativeSource('app/portal/client/akademie/index.web.tsx', readFileSync('app/portal/client/akademie/index.web.tsx', 'utf8'));
const compiled = { exports: {} as { default: React.ComponentType } };
new Function('require', 'module', 'exports', transformSync(nativeEntry, { loader: 'tsx', format: 'cjs' }).code)((id: string) => {
  if (id === '@/screens/portal/NativeAcademyPortalEntry.native') return { NativeAcademyPortalEntry };
  throw Error('Unexpected native Academy route dependency: ' + id);
}, compiled, compiled.exports);
const Route = compiled.exports.default;
let root: Root, host: HTMLDivElement;
const render = async (node = <Route />) => { await act(async () => root.render(node)); };
const button = (label: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].find(node => node.textContent === label)!;
const click = async (label: string) => { await act(async () => button(label).click()); };
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); vi.clearAllMocks(); f.open.mockResolvedValue(undefined); f.signOut.mockResolvedValue(undefined); host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
describe('native Academy portal boundary', () => {
  it('receives a direct client Academy link at a browser boundary without loading the native Academy workplace', async () => {
    await render(); expect(host.querySelector('[data-testid=native-academy-browser-entry]')).not.toBeNull();
    expect(host.textContent).toContain('Akademie im Browser nutzen'); expect(f.open).not.toHaveBeenCalled();
    await click('Zur Portalübersicht'); expect(f.replace).toHaveBeenCalledExactlyOnceWith('/portal/client');
  });
  it('opens only the public login URL and handles a failed native browser intent with a retry', async () => {
    f.open.mockRejectedValueOnce(new Error('No activity')); await render(); await click('Im Browser öffnen');
    expect(host.querySelector('[role=alert]')?.textContent).toContain('Browser konnte nicht geöffnet');
    await click('Im Browser öffnen'); expect(f.open).toHaveBeenLastCalledWith('https://www.caresuiteplus.app/auth/portal-code-login');
    expect(host.querySelector('[role=alert]')).toBeNull();
  });
  it('keeps Academy-only family access at its existing browser-only entry and provides a recoverable signout error', async () => {
    f.signOut.mockRejectedValueOnce(new Error('offline')); await render(<NativeAcademyPortalEntry academyOnly />);
    expect(host.querySelector('[data-testid=family-browser-access]')).not.toBeNull(); expect(button('Zur Portalübersicht')).toBeUndefined();
    await click('Abmelden'); expect(host.querySelector('[role=alert]')?.textContent).toContain('Abmelden ist gerade nicht möglich'); expect(f.replace).not.toHaveBeenCalled();
    await click('Abmelden'); expect(f.replace).toHaveBeenLastCalledWith('/auth/client-login');
  });
});
