// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { GoogleMapsLiveMap } from '@/components/maps/GoogleMapsLiveMap.web';
import type { AssistLiveRoutePoint } from '@/lib/assist/assistMapProvider';
const state = vi.hoisted(() => ({ map: { panTo: vi.fn(), fitBounds: vi.fn() }, namespace: { maps: { Polyline: class { setMap() {} }, LatLngBounds: class { extend() {} } } } }));
vi.mock('@/components/maps/useStableGoogleMap', () => ({ useStableGoogleMap: () => ({ map: state.map, google: state.namespace, ready: true, error: null }) }));
vi.mock('@/components/maps/useStableMapMarkers', () => ({ useStableMapMarkers: vi.fn() }));
vi.mock('@/components/maps/useVisibleMapPolling', () => ({ useVisibleMapPolling: () => ({ containerRef: { current: null }, isVisible: true }) }));
let host: HTMLDivElement; let root: Root;
beforeEach(() => { (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true; host = document.createElement('div'); root = createRoot(host); vi.clearAllMocks(); });
afterEach(async () => { await act(async () => root.unmount()); });
const marker = { id: 'selected', latitude: 51.5, longitude: 7.4, label: 'Gewählte Person', capturedAt: '2026-10-17T08:00:00Z' };
const segment: AssistLiveRoutePoint[] = [{ latitude: 51.5, longitude: 7.4, capturedAt: '2026-10-17T07:55:00Z', accuracyMeters: 10 }, { latitude: 51.5005, longitude: 7.4, capturedAt: '2026-10-17T07:56:00Z', accuracyMeters: 10 }];
it('centers the explicit selection and refits the route only after a deliberate click', async () => {
  await act(async () => root.render(<GoogleMapsLiveMap markers={[marker]} selectedMarkerId="selected" routeSegments={[segment]} routeIdentity="visit-1" showControls showMeta={false} appearance="light" />));
  expect(state.map.fitBounds).toHaveBeenCalledTimes(1);
  await act(async () => root.render(<GoogleMapsLiveMap markers={[{ ...marker, latitude: 51.51 }]} selectedMarkerId="selected" routeSegments={[[{ ...segment[0], capturedAt: '2026-10-17T07:50:00Z' }, ...segment]]} routeIdentity="visit-1" showControls showMeta={false} appearance="light" />));
  expect(state.map.fitBounds).toHaveBeenCalledTimes(1);
  const buttons = Array.from(host.querySelectorAll('button'));
  await act(async () => buttons.find(button => button.textContent === 'Auswahl zentrieren')!.click());
  expect(state.map.panTo).toHaveBeenCalledWith({ lat: 51.51, lng: 7.4 });
  await act(async () => buttons.find(button => button.textContent === 'Route anzeigen')!.click());
  expect(state.map.fitBounds).toHaveBeenCalledTimes(2);
});
it('never substitutes another marker for a missing explicit selection', async () => {
  await act(async () => root.render(<GoogleMapsLiveMap markers={[marker]} selectedMarkerId="missing" showControls />));
  const center = Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'Auswahl zentrieren')!;
  expect(center.disabled).toBe(true);
  expect(host.textContent).not.toContain('Gewählte Person');
  await act(async () => center.click());
  expect(state.map.panTo).not.toHaveBeenCalled();
});
