// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { buildSync } from 'esbuild';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nativeMapBounds, nativeMapLines } from '@/lib/maps/nativeAssistMapData';
const api = { map: null as any, sources: new Map<string, any>(), select: vi.fn(), ease: vi.fn(), fit: vi.fn(), jump: vi.fn() };
const Box = (p: any) => <div>{p.children}</div>;
const deps: Record<string, unknown> = {
  react: React, 'react/jsx-runtime': await import('react/jsx-runtime'),
  'react-native': { View: Box, Text: (p: any) => <span>{p.children}</span>, ActivityIndicator: () => <span>Loading</span>, Pressable: (p: any) => <button onClick={p.onPress}>{p.children}</button>, StyleSheet: { create: (s: any) => s, absoluteFill: {} } },
  '@maplibre/maplibre-react-native': { Map: (p: any) => { api.map = p; return <div>{p.children}</div>; }, GeoJSONSource: (p: any) => { api.sources.set(p.id, p); return <div>{p.children}</div>; }, Layer: () => null, Camera: React.forwardRef((_p: any, ref) => { React.useImperativeHandle(ref, () => ({ easeTo: api.ease, fitBounds: api.fit, jumpTo: api.jump })); return null; }) },
  '@/theme': { typography: { bodyStrong: {}, caption: {} } }, '@/lib/assist/assistMapProvider': { formatMapLastUpdated: () => 'gerade eben' },
};
const code = buildSync({ entryPoints: ['src/components/maps/AssistLiveMap.native.tsx'], bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic', external: Object.keys(deps) }).outputFiles[0].text;
const module = { exports: {} as any }; new Function('require', 'module', 'exports', code)((id: string) => deps[id], module, module.exports);
const NativeMap = module.exports.AssistLiveMap;
const point = (latitude: number, longitude: number) => ({ latitude, longitude, capturedAt: '2026-10-09T00:00:00Z', accuracyMeters: 5 });
let host: HTMLDivElement, root: Root;
beforeEach(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; vi.clearAllMocks(); api.map = null; api.sources.clear(); host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
describe('native live map', () => {
  it('keeps GPS gaps as separate lines instead of drawing a fictitious drive', () => {
    expect(nativeMapLines([[point(51, 7), point(51.1, 7.1), point(NaN, 7), point(51.2, 7.2), point(51.3, 7.3)]]).features.map(f => f.geometry.coordinates)).toEqual([[[7, 51], [7.1, 51.1]], [[7.2, 51.2], [7.3, 51.3]]]);
    expect(nativeMapBounds([point(NaN, 1), point(51, 7), point(52, 8)])).toEqual([7, 51, 8, 52]);
  });
  it('renders an empty state without inventing a location', async () => {
    await act(async () => root.render(<NativeMap position={null} markers={[{ id: 'bad', label: 'bad', latitude: Infinity, longitude: 7 }]} />));
    expect(host.textContent).toContain('Keine Standortdaten vorhanden'); expect(api.map).toBeNull();
  });
  it('only allows existing markers to select a person or a visit', async () => {
    await act(async () => root.render(<NativeMap position={null} markers={[{ id: 'a', label: 'A', ...point(51, 7) }, { id: 'b', label: 'B', ...point(52, 8) }]} onMarkerSelect={api.select} />));
    const press = api.sources.get('care-position-markers').onPress;
    await act(async () => press({ nativeEvent: { features: [{ properties: { markerId: 'other-tenant' } }] }, stopPropagation: vi.fn() })); expect(api.select).not.toHaveBeenCalled();
    await act(async () => press({ nativeEvent: { features: [{ properties: { markerId: 'b' } }] }, stopPropagation: vi.fn() })); expect(api.select).toHaveBeenCalledWith('b');
    expect(api.map.mapStyle).toBe('https://tiles.openfreemap.org/styles/bright');
  });
  it('retains coordinates and recorded lines after a map error and reload', async () => {
    const route = [point(51, 7), point(51.1, 7.1)]; await act(async () => root.render(<NativeMap position={route[0]} routePoints={route} />));
    await act(async () => api.map.onDidFailLoadingMap()); expect(host.textContent).toContain('GPS-Daten und Fahrtstrecken bleiben erhalten'); expect(host.textContent).toContain('51.00000');
    const button = [...host.querySelectorAll('button')].find(x => x.textContent === 'Karte erneut laden')!; await act(async () => button.click());
    expect(api.sources.get('care-recorded-route').data.features[0].geometry.coordinates).toEqual([[7, 51], [7.1, 51.1]]);
  });
});
