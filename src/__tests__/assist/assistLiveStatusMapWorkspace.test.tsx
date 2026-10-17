// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AssistLiveMonitoringRow } from '@/features/assistLive/getAssistLiveMonitoring';
import type { GoogleMapsLiveMapProps } from '@/components/maps/GoogleMapsLiveMap.web';
import { AssistLiveStatusMapPanel } from '@/components/assist/AssistLiveStatusMapPanel.web';
import { getLiveMapPosition, getLiveMapSignal, getLivePlannedRoute } from '@/features/assistLive/liveStatusMapPresentation.web';
import { buildAssistLiveRouteSummary } from '@/features/assistLive/getAssistLiveMonitoring';

const map = vi.hoisted(() => ({ props: null as GoogleMapsLiveMapProps | null }));
vi.mock('@/components/maps/GoogleMapsLiveMap.web', () => ({ GoogleMapsLiveMap: (props: GoogleMapsLiveMapProps) => { map.props = props; return <div data-map="true"><button onClick={() => props.onMarkerSelect?.('other')}>Andere Position auswählen</button></div>; } }));
const nowMs = Date.parse('2026-10-17T10:00:00Z');
const iso = (offset = 0) => new Date(nowMs + offset).toISOString();
function makeRow(): AssistLiveMonitoringRow {
  return {
    assignmentId: 'assignment-1', visitId: 'visit-1', tenantId: 'tenant-1', clientId: 'client-1', employeeId: 'employee-1',
    employeeName: 'Testperson Eins', clientName: 'Testklient Eins', title: 'Begleitung', status: 'gestartet', canonicalStatus: 'started', displayStatus: 'gestartet', statusColor: '#089876',
    plannedStartAt: iso(-3600000), plannedEndAt: iso(3600000), actualStartAt: iso(-1800000), actualEndAt: null, delayMinutes: null, overrunMinutes: null, docStatus: 'na', signatureStatus: 'na', problemStatus: 'none', cancelRequest: false, rescheduleRequest: false,
    tracking: { assignmentId: 'assignment-1', tenantId: 'tenant-1', status: 'gestartet', consent: { granted: true, grantedAt: iso(-3600000), explainedAt: iso(-3600000) }, gpsPermission: 'granted', trackingActive: true, assistVisible: true, clientPortalVisible: false, deviceHeartbeatAt: iso(-10000), lastPosition: { latitude: 51.5, longitude: 7.4, capturedAt: iso(-10000), accuracyMeters: 10 }, timers: { driveSeconds: 600, serviceSeconds: 600, pauseSeconds: 0, activeTimer: 'service', driveStartedAt: null, serviceStartedAt: iso(-600000), pauseStartedAt: null }, geofence: null, warnings: [], arrivalProof: 'gps' }, route: null,
  };
}
let host: HTMLDivElement;
let root: Root;
beforeEach(() => { (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true; host = document.createElement('div'); document.body.append(host); root = createRoot(host); map.props = null; });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe('Live-Status map', () => {
  it('keeps a selected assignment with no position empty instead of displaying another employee', async () => {
    const row = makeRow(); row.tracking!.lastPosition = null;
    await act(async () => root.render(<AssistLiveStatusMapPanel row={row} selectedAssignmentId={row.assignmentId} nowMs={nowMs} markers={[{ id: 'other', latitude: 52, longitude: 8, label: 'Andere Person', capturedAt: iso() }]} />));
    expect(host.textContent).toContain('Testperson Eins');
    expect(host.textContent).toContain('Wartet auf Position');
    expect(host.querySelector('[data-map]')).toBeNull();
  });

  it('opens the actual visit and forwards explicit map marker selection', async () => {
    const open = vi.fn(); const select = vi.fn(); const row = makeRow();
    await act(async () => root.render(<AssistLiveStatusMapPanel row={row} nowMs={nowMs} onOpenAssignment={open} onMarkerSelect={select} />));
    await act(async () => Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'Einsatz öffnen')!.click());
    expect(open).toHaveBeenCalledWith('visit-1');
    await act(async () => host.querySelector('button')!.click());
    expect(select).toHaveBeenCalledWith('other');
    expect(map.props?.selectedMarkerId).toBe('assignment-1');
  });

  it('labels stale recorded positions and does not count future or bad fixes as live', async () => {
    const row = makeRow(); expect(getLiveMapSignal(row, nowMs).tone).toBe('live');
    row.tracking!.lastPosition!.capturedAt = iso(-120000);
    expect(getLiveMapSignal(row, nowMs).label).toBe('Signal verzögert');
    expect(getLiveMapPosition(row, nowMs)).not.toBeNull();
    await act(async () => root.render(<AssistLiveStatusMapPanel row={row} nowMs={nowMs} />));
    expect(host.textContent).toContain('vor 2 Min.');
    row.tracking!.lastPosition!.capturedAt = iso(1);
    expect(getLiveMapPosition(row, nowMs)).toBeNull();
    expect(getLiveMapSignal(row, nowMs).label).toBe('Position nicht bestätigt');
    row.tracking!.lastPosition!.capturedAt = iso(); row.tracking!.lastPosition!.accuracyMeters = 500;
    expect(getLiveMapPosition(row, nowMs)).toBeNull();
    row.tracking!.lastPosition!.accuracyMeters = 5; row.tracking!.lastPosition!.latitude = Number.NaN;
    expect(getLiveMapPosition(row, nowMs)).toBeNull();
  });

  it('does not label paused tracking or a future heartbeat live', () => {
    const row = makeRow(); row.tracking!.trackingActive = false;
    expect(getLiveMapSignal(row, nowMs).label).toBe('Letzte Position');
    row.tracking!.trackingActive = true; row.tracking!.deviceHeartbeatAt = iso(1000);
    expect(getLiveMapSignal(row, nowMs).tone).toBe('warning');
    row.tracking!.consent.granted = false;
    expect(getLiveMapPosition(row, nowMs)).toBeNull();
    expect(getLiveMapSignal(row, nowMs).label).toBe('Keine Standortfreigabe');
  });

  it('toggles only real planned geometry and preserves separated measured GPS segments', async () => {
    const row = makeRow();
    row.tracking!.googleRouteReference = { provider: 'osm', source: 'osm', requestedAt: iso(-100000), origin: { latitude: 38.5, longitude: -120.2 }, destinationAddress: 'Testziel', distanceMeters: 1000, durationMinutes: 10, encodedPolyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' };
    row.route = buildAssistLiveRouteSummary([
      { latitude: 51.5, longitude: 7.4, capturedAt: iso(-1200000), accuracyMeters: 8 },
      { latitude: 51.5005, longitude: 7.4, capturedAt: iso(-1140000), accuracyMeters: 8 },
      { latitude: 51.51, longitude: 7.4, capturedAt: iso(-600000), accuracyMeters: 8 },
      { latitude: 51.5105, longitude: 7.4, capturedAt: iso(-540000), accuracyMeters: 8 },
    ]);
    await act(async () => root.render(<AssistLiveStatusMapPanel row={row} nowMs={nowMs} />));
    expect(map.props?.routeSegments).toHaveLength(2);
    expect(map.props?.plannedRoutePoints).toHaveLength(3);
    expect(host.querySelector('details')?.open).toBe(false);
    expect(host.textContent).toContain('Eine GPS-Lücke ist noch ungeklärt');
    await act(async () => host.querySelector<HTMLInputElement>('input[type=checkbox]')!.click());
    expect(map.props?.plannedRoutePoints).toEqual([]);
    expect(map.props?.routeSegments).toHaveLength(2);
  });

  it('shows a truncated-route warning outside collapsed details', async () => {
    const warning = 'Die Route zeigt die letzten 1.500 Standortpunkte; die Entfernung kann unvollständig sein.';
    const row = { ...makeRow(), warnings: [warning] };
    row.route = buildAssistLiveRouteSummary([
      { latitude: 51.5, longitude: 7.4, capturedAt: iso(-60000), accuracyMeters: 10 },
      { latitude: 51.5005, longitude: 7.4, capturedAt: iso(-10000), accuracyMeters: 10 },
    ]);
    await act(async () => root.render(<AssistLiveStatusMapPanel row={row} nowMs={nowMs} />));
    const notice = Array.from(host.querySelectorAll('[role=status]')).find(element => element.textContent === warning);
    expect(notice).toBeDefined();
    expect(notice?.closest('details')).toBeNull();
    expect(host.querySelector('details')?.open).toBe(false);
  });

  it('distinguishes a failed tracking read from genuinely missing GPS data', async () => {
    const row = { ...makeRow(), tracking: null, trackingError: 'Standortdaten konnten nicht geladen werden.', warnings: ['Standortdaten konnten nicht geladen werden.'] };
    await act(async () => root.render(<AssistLiveStatusMapPanel row={row} nowMs={nowMs} />));
    expect(host.textContent).toContain('Standortdaten nicht verfügbar');
    expect(host.textContent).toContain('Standortdaten konnten nicht geladen werden.');
    expect(host.textContent).not.toContain('noch keine Standortdaten übermittelt');
    expect(host.textContent).not.toContain('noch keine auswertbare GPS-Strecke');
    expect(host.querySelector('[data-map]')).toBeNull();
  });

  it('rejects malformed, unavailable and future route references without invented geometry', () => {
    const ref = { provider: 'osm' as const, source: 'osm' as const, requestedAt: iso(), origin: { latitude: 38.5, longitude: -120.2 }, destinationAddress: 'Testziel', distanceMeters: 1000, durationMinutes: 10, encodedPolyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' };
    expect(getLivePlannedRoute(ref, nowMs)).toHaveLength(3);
    expect(getLivePlannedRoute({ ...ref, encodedPolyline: '_p~iF~ps|U_' }, nowMs)).toEqual([]);
    expect(getLivePlannedRoute({ ...ref, encodedPolyline: '%%%%' }, nowMs)).toEqual([]);
    expect(getLivePlannedRoute({ ...ref, source: 'unavailable' }, nowMs)).toEqual([]);
    expect(getLivePlannedRoute({ ...ref, requestedAt: iso(1) }, nowMs)).toEqual([]);
  });
});
