// @vitest-environment happy-dom
import React, { act } from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebNavigationMount } from '@/components/navigation/WebNavigationMount.web';
import { WebNavigationMount as NativeMount } from '@/components/navigation/WebNavigationMount';
import { useHydrated } from '@/hooks/useHydrated.web';

const state = vi.hoisted(() => ({ authReady: true, pathname: '/assist/live-status' }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => ({ authReady: state.authReady }) }));
vi.mock('expo-router', () => ({ usePathname: () => state.pathname }));

let host: HTMLDivElement, root: Root | undefined;
beforeEach(() => {
  state.authReady = true; state.pathname = '/assist/live-status';
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); document.body.append(host);
});
afterEach(async () => { if (root) await act(async () => root!.unmount()); root = undefined; host.remove(); });

describe('web navigation hydration', () => {
  it('hydrates a deep link from the shared home HTML without rendering the old page', async () => {
    const oldPage = vi.fn(), newPage = vi.fn(), recoverableError = vi.fn();
    function OldPage() { oldPage(); return <div>Alte Startseite</div>; }
    function NewPage() { newPage(); return <section>Einsätze</section>; }
    host.innerHTML = renderToString(<WebNavigationMount><OldPage /></WebNavigationMount>);
    expect(oldPage).not.toHaveBeenCalled();
    await act(async () => {
      root = hydrateRoot(host, <WebNavigationMount><NewPage /></WebNavigationMount>, { onRecoverableError: recoverableError });
    });
    expect(host.textContent).toBe('Einsätze'); expect(newPage).toHaveBeenCalledOnce();
    expect(recoverableError).not.toHaveBeenCalled(); expect(oldPage).not.toHaveBeenCalled();
    await act(async () => root!.render(<WebNavigationMount><section>Desktop</section></WebNavigationMount>));
    expect(host.textContent).toBe('Desktop'); expect(recoverableError).not.toHaveBeenCalled();
  });
  it('does not defer native navigation', () => {
    expect(renderToString(<NativeMount><span>Portal</span></NativeMount>)).toContain('Portal');
  });
  it('mounts the requested protected page only after session restoration, with every nested guard already hydrated', async () => {
    state.authReady = false;
    const frames: boolean[] = [];
    function DeepPage() { const ready = useHydrated(); frames.push(ready); return <section>Live-Status</section>; }
    host.innerHTML = renderToString(<WebNavigationMount><DeepPage /></WebNavigationMount>);
    const errors = vi.fn();
    await act(async () => { root = hydrateRoot(host, <WebNavigationMount><DeepPage /></WebNavigationMount>, { onRecoverableError: errors }); });
    expect(frames).toEqual([]);
    state.authReady = true;
    await act(async () => root!.render(<WebNavigationMount><DeepPage /></WebNavigationMount>));
    expect(host.textContent).toBe('Live-Status');
    expect(frames.length).toBeGreaterThan(0);
    expect(frames.every(Boolean)).toBe(true);
    expect(errors).not.toHaveBeenCalled();
  });
  it('keeps navigation mounted during a subsequent logout instead of discarding its current page', async () => {
    const unmounted = vi.fn();
    function Page() { React.useEffect(() => unmounted, []); return <section>Live-Status</section>; }
    host.innerHTML = renderToString(<WebNavigationMount><Page /></WebNavigationMount>);
    await act(async () => { root = hydrateRoot(host, <WebNavigationMount><Page /></WebNavigationMount>); });
    state.authReady = false;
    await act(async () => root!.render(<WebNavigationMount><Page /></WebNavigationMount>));
    expect(host.textContent).toBe('Live-Status');
    expect(unmounted).not.toHaveBeenCalled();
  });
  it.each(['/auth/forgot-password', '/auth/reset-password', '/support'])('keeps public %s available while a saved session is pending', async pathname => {
    state.pathname = pathname; state.authReady = false;
    host.innerHTML = renderToString(<WebNavigationMount><section>Öffentliche Seite</section></WebNavigationMount>);
    await act(async () => { root = hydrateRoot(host, <WebNavigationMount><section>Öffentliche Seite</section></WebNavigationMount>); });
    expect(host.textContent).toBe('Öffentliche Seite');
  });
});
