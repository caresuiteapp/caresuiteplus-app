// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSync } from 'esbuild';
import { parseDesktopWeather, useDesktopWeather } from '@/hooks/useDesktopWeather';
let result: ReturnType<typeof useDesktopWeather>;
let root: Root, host: HTMLDivElement;
const observation = (temperature: unknown = 0, timestamp = new Date().toISOString()) => ({
  weather: { temperature, timestamp, icon: 'clear-night', source_ids: { temperature: 1 } },
  sources: [{ id: 1, station_name: 'Teststation' }],
});

// Exercise the generated native view; Android file/location storage remains at
// the onChoose boundary. This verifies interactions, not Android layout.
const flattenNativeStyle = (style: any): any => Array.isArray(style) ? Object.assign({}, ...style.map(flattenNativeStyle)) : style ?? {};
const NativeBox = (p: any) => <div data-scroll={p.keyboardShouldPersistTaps} style={flattenNativeStyle(p.style)}>{p.children}</div>;
const NativeText = (p: any) => <span role={p.accessibilityRole} aria-live={p.accessibilityLiveRegion}>{p.children}</span>;
const NativePressable = (p: any) => {
  const Host = p.accessibilityRole === 'button' ? 'button' : 'div';
  return <Host aria-label={p.accessibilityLabel} aria-selected={p.accessibilityState?.selected} {...(Host === 'button' ? { type: 'button' as const, disabled: p.disabled } : {})} onClick={p.disabled ? undefined : p.onPress} style={flattenNativeStyle(typeof p.style === 'function' ? p.style({ pressed: false }) : p.style)}>{p.children}</Host>;
};
const nativeWeatherHost = {
  View: NativeBox, ScrollView: NativeBox, Pressable: NativePressable,
  Modal: (p: any) => p.visible ? <div role="dialog">{p.children}</div> : null,
  StyleSheet: { create: (styles: any) => styles },
  useWindowDimensions: () => ({ width: 360, height: 640, scale: 1, fontScale: 2 }),
};
const nativeWeatherDependencies: Record<string, unknown> = {
  react: React, 'react/jsx-runtime': await import('react/jsx-runtime'), 'react-native': nativeWeatherHost,
  '@/components/ui/CareSuiteNativeText': {
    CareSuiteNativeText: NativeText,
    CareSuiteNativeTextInput: (p: any) => <input aria-label={p.accessibilityLabel} value={p.value} onInput={event => p.onChangeText(event.currentTarget.value)} />,
  },
  '@/components/layout/NativeWorkspaceElements.native': {
    NativeDetails: (p: any) => <details>{p.children}</details>, NativeSummary: (p: any) => <summary>{p.children}</summary>,
    NativeP: (p: any) => <p>{p.children}</p>, NativeA: (p: any) => <a href={p.href}>{p.children}</a>,
  },
};
const nativeWeatherCompiled = buildSync({ entryPoints: ['src/liquid-command/screens/DesktopWeatherLocationDialog.native.tsx'], bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic', external: Object.keys(nativeWeatherDependencies) }).outputFiles[0].text;
const nativeWeatherModule = { exports: {} as any };
new Function('require', 'module', 'exports', nativeWeatherCompiled)((id: string) => {
  if (!(id in nativeWeatherDependencies)) throw new Error(`Unexpected native weather dependency: ${id}`);
  return nativeWeatherDependencies[id];
}, nativeWeatherModule, nativeWeatherModule.exports);
const NativeWeatherDialog = nativeWeatherModule.exports.DesktopWeatherLocationDialog;

describe('native desktop weather selection', () => {
  const choose = vi.fn(), close = vi.fn();
  const show = async (visible = true, preferenceError: string | null = null) => {
    await act(async () => root.render(<NativeWeatherDialog visible={visible} place={null} preferenceError={preferenceError} onChoose={choose} onClose={close} />));
  };
  const search = async (query: string) => {
    const input = host.querySelector('input')!;
    await act(async () => { input.value = query; input.dispatchEvent(new Event('input', { bubbles: true })); });
  };
  const select = (text: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.includes(text))!;
  beforeEach(() => { choose.mockReset().mockResolvedValue(true); close.mockReset(); });

  it('uses the current weather view and local postcode search without network or a location prompt', async () => {
    await show();
    expect(host.textContent).toContain('IHR DESKTOP');
    expect(host.textContent).toContain('Aktuelle Auswahl');
    expect(host.textContent).toContain('auf diesem Gerät gespeichert');
    expect(host.textContent).toContain('Mindestens zwei Zeichen eingeben und anschließend einen Treffer auswählen.');
    expect(host.querySelector('[data-scroll="handled"]')).toBeTruthy();
    await search('44628');
    const hit = select('44628 Herne'); expect(hit).toBeTruthy();
    await act(async () => hit.click());
    expect(choose).toHaveBeenCalledWith(expect.objectContaining({ name: 'Herne', postcode: '44628', latitude: expect.any(Number), longitude: expect.any(Number) }));
    expect(Object.keys(choose.mock.calls[0][0]).sort()).toEqual(['district', 'latitude', 'longitude', 'name', 'postcode', 'region']);
    expect(close).toHaveBeenCalledOnce(); expect(fetch).not.toHaveBeenCalled();
    expect(navigator.geolocation.getCurrentPosition).not.toHaveBeenCalled();
    expect(host.querySelectorAll('details a')).toHaveLength(3);
  });

  it('waits for native storage, prevents duplicate choices and leaves failed storage open for retry', async () => {
    let resolve!: (value: boolean) => void;
    choose.mockImplementationOnce(() => new Promise<boolean>(done => { resolve = done; }));
    await show(); await search('44628');
    await act(async () => select('44628 Herne').click());
    expect(host.textContent).toContain('Wetterort wird gespeichert'); expect(close).not.toHaveBeenCalled();
    expect(select('Aktuellen Standort verwenden').disabled).toBe(true);
    await act(async () => select('Aktuellen Standort verwenden').click()); expect(choose).toHaveBeenCalledOnce();
    await act(async () => resolve(false));
    await show(true, 'Speichern fehlgeschlagen'); expect(host.querySelector('[role="alert"]')?.textContent).toBe('Speichern fehlgeschlagen');
    await act(async () => select('Aktuellen Standort verwenden').click());
    expect(choose).toHaveBeenLastCalledWith(null); expect(close).toHaveBeenCalledOnce();
  });

  it('reports thrown storage errors and ignores a late result after the dialog was closed and reopened', async () => {
    choose.mockRejectedValueOnce(new Error('storage unavailable')); await show();
    await act(async () => select('Aktuellen Standort verwenden').click());
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('konnte nicht gespeichert werden'); expect(close).not.toHaveBeenCalled();
    let resolve!: (value: boolean) => void;
    choose.mockImplementationOnce(() => new Promise<boolean>(done => { resolve = done; }));
    await search('Herne'); await act(async () => select('Aktuellen Standort verwenden').click());
    await show(false); await show(); expect(host.querySelector('input')?.value).toBe('');
    await act(async () => resolve(true)); expect(close).not.toHaveBeenCalled();
    await search('no-such-german-place-xyz'); expect(host.textContent).toContain('Kein passender Ort. Versuchen Sie einen anderen Ortsnamen oder die Postleitzahl.');
  });
});
function Probe({ owner = 'test' }) { const weather = useDesktopWeather(owner); React.useLayoutEffect(() => { result = weather; }); return <span>{weather.message}</span>; }
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
