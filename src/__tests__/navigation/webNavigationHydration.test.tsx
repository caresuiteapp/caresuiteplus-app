// @vitest-environment happy-dom
import React, { act } from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebNavigationMount } from '@/components/navigation/WebNavigationMount.web';
import { WebNavigationMount as NativeMount } from '@/components/navigation/WebNavigationMount';

let host: HTMLDivElement, root: Root | undefined;
beforeEach(() => {
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
});
