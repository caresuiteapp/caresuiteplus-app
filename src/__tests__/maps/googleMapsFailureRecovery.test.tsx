// @vitest-environment happy-dom
import React, { act, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadGoogleMapsApi, resetGoogleMapsLoaderForTests, subscribeGoogleMapsFailure } from '@/lib/maps/googleMapsLoader';
import { useStableGoogleMap } from '@/components/maps/useStableGoogleMap';

const center = { lat: 52, lng: 13 };
function initialize() {
  window.google = { maps: { Map: class {
    panTo() {}
    setCenter() {}
    fitBounds() {}
  } } } as never;
  window.__caresuiteGoogleMapsInit?.();
}

describe('Google Maps provider failures', () => {
  beforeEach(() => {
    (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    (window as unknown as { happyDOM: { settings: { disableJavaScriptFileLoading: boolean; handleDisabledFileLoadingAsSuccess: boolean } } }).happyDOM.settings.disableJavaScriptFileLoading = true;
    (window as unknown as { happyDOM: { settings: { handleDisabledFileLoadingAsSuccess: boolean } } }).happyDOM.settings.handleDisabledFileLoadingAsSuccess = true;
    resetGoogleMapsLoaderForTests();
    delete window.google;
    delete window.__caresuiteGoogleMapsInit;
    delete window.gm_authFailure;
  });
  afterEach(() => {
    resetGoogleMapsLoaderForTests();
    document.querySelectorAll('script[data-caresuite-google-maps]').forEach((script) => script.remove());
    vi.useRealTimers();
  });

  it('rejects missing authorization before initialization and never reuses a rejected namespace', async () => {
    const result = expect(loadGoogleMapsApi('test-browser-key')).rejects.toThrow(/nicht freigegeben/);
    window.gm_authFailure?.();
    await result;
    window.google = { maps: {} } as never;
    await expect(loadGoogleMapsApi('test-browser-key')).rejects.toThrow(/nicht freigegeben/);
  });

  it('bounds a script that never answers and allows a later network retry', async () => {
    const result = expect(loadGoogleMapsApi('test-browser-key')).rejects.toThrow(/antwortet nicht/);
    await vi.advanceTimersByTimeAsync(15_000);
    await result;
    expect(document.querySelector('script[data-caresuite-google-maps]')).toBeNull();
    const retry = loadGoogleMapsApi('test-browser-key');
    initialize();
    expect(await retry).toBe(window.google);
  });

  it('shares one script between simultaneous callers', async () => {
    const first = loadGoogleMapsApi('test-browser-key');
    const second = loadGoogleMapsApi('test-browser-key');
    expect(document.querySelectorAll('script[data-caresuite-google-maps]')).toHaveLength(1);
    initialize();
    expect(await first).toBe(await second);
  });

  it('notifies mounted maps even when authorization fails after the script was ready', async () => {
    const failure = vi.fn();
    const unsubscribe = subscribeGoogleMapsFailure(failure);
    const result = loadGoogleMapsApi('test-browser-key');
    initialize();
    await result;
    window.gm_authFailure?.();
    expect(failure).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringMatching(/GPS-Punkte bleiben erhalten/) }));
    unsubscribe();
  });

  it('replaces the unusable map with its error fallback after a late provider failure', async () => {
    function Probe() {
      const containerRef = useRef<HTMLDivElement>(null);
      const state = useStableGoogleMap({ apiKey: 'test-browser-key', containerRef, center });
      return <><div ref={containerRef} /><output>{state.error ?? (state.ready ? 'ready' : 'loading')}</output><span>{state.map ? 'map' : 'no-map'}</span></>;
    }
    const host = document.createElement('div');
    const root = createRoot(host);
    try {
      await act(async () => root.render(<Probe />));
      await act(async () => initialize());
      expect(host.querySelector('output')?.textContent).toBe('ready');
      await act(async () => window.gm_authFailure?.());
      expect(host.querySelector('output')?.textContent).toMatch(/nicht freigegeben/);
      expect(host.querySelector('span')?.textContent).toBe('no-map');
    } finally {
      await act(async () => root.unmount());
    }
  });
});
