// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseDesktopWeather, useDesktopWeather } from '@/hooks/useDesktopWeather';
let result: ReturnType<typeof useDesktopWeather>;
let root: Root, host: HTMLDivElement;
const observation = (temperature: unknown = 0, timestamp = new Date().toISOString()) => ({
  weather: { temperature, timestamp, icon: 'clear-night', source_ids: { temperature: 1 } },
  sources: [{ id: 1, station_name: 'Teststation' }],
});
function Probe({ owner = 'test' }) { result = useDesktopWeather(owner); return <span>{result.message}</span>; }
const render = async (owner = 'test') => { await act(async () => root.render(<Probe owner={owner} />)); };
const refresh = async () => { await act(async () => { await result.refresh(); }); };
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); root = createRoot(host);
  vi.stubGlobal('navigator', {
    permissions: { query: vi.fn().mockResolvedValue({ state: 'prompt' }) },
    geolocation: { getCurrentPosition: vi.fn((success: Function) => success({ coords: { latitude: 52.52345, longitude: 13.41234 } })) },
  });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => observation() }));
});
afterEach(async () => { await act(async () => root.unmount()); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('desktop location weather', () => {
  it('keeps weather visible without requesting location until the user chooses it', async () => {
    await render(); expect(result.status).toBe('idle'); expect(result.message).toBe('Standort verwenden');
    expect(navigator.geolocation.getCurrentPosition).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
    await refresh(); expect(result.status).toBe('ready'); expect(result.data?.temperature).toBe(0);
    expect(result.data?.label).toBe('Klar'); expect(result.message).toContain('Teststation');
    expect(fetch).toHaveBeenCalledWith('https://api.brightsky.dev/current_weather?lat=52.52&lon=13.41', expect.objectContaining({ credentials: 'omit' }));
  });
  it('loads automatically with previously granted permission', async () => {
    vi.mocked(navigator.permissions.query).mockResolvedValue({ state: 'granted' } as PermissionStatus);
    await render(); expect(result.status).toBe('ready');
  });
  it('shows permission denial and supports retry without invented weather', async () => {
    vi.mocked(navigator.geolocation.getCurrentPosition).mockImplementationOnce((_ok, fail) => fail!({ code: 1 } as GeolocationPositionError));
    await render(); await refresh(); expect(result.status).toBe('error'); expect(result.message).toContain('gesperrt'); expect(result.data).toBeNull();
    expect(fetch).not.toHaveBeenCalled(); await refresh(); expect(result.status).toBe('ready');
  });
  it('reports a network error and clears any previous temperature', async () => {
    await render(); await refresh(); vi.mocked(fetch).mockRejectedValueOnce(new Error('offline'));
    await refresh(); expect(result.status).toBe('error'); expect(result.data).toBeNull();
  });
  it.each([null, NaN, '17'])('rejects missing or invalid temperature %s', temperature => {
    expect(() => parseDesktopWeather(observation(temperature))).toThrow();
  });
  it('rejects stale or missing timestamps', () => {
    expect(() => parseDesktopWeather(observation(17, new Date(Date.now() - 2 * 60 * 60_000).toISOString()))).toThrow();
    expect(() => parseDesktopWeather(observation(17, ''))).toThrow();
  });
  it('does not let an old account request overwrite a new account', async () => {
    let complete!: (value: Response) => void;
    vi.mocked(fetch).mockReturnValueOnce(new Promise<Response>(resolve => { complete = resolve; }));
    await render(); let pending!: Promise<void>;
    await act(async () => { pending = result.refresh(); });
    await render('other');
    await act(async () => { complete({ ok: true, json: async () => observation(17) } as Response); await pending; });
    expect(result.status).toBe('idle'); expect(result.data).toBeNull();
  });
  it('times out geolocation even when the browser does not call back', async () => {
    vi.useFakeTimers(); vi.mocked(navigator.geolocation.getCurrentPosition).mockImplementation(() => undefined);
    await render(); let pending!: Promise<void>;
    await act(async () => { pending = result.refresh(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); await pending; });
    expect(result.status).toBe('error'); expect(result.message).toContain('nicht erreichbar');
  });
});
