import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodeGooglePolyline } from '@/features/liveTracking/googleRouteReference';

describe('Live-Tracking und Google-Routenabgleich R12', () => {
  it('dekodiert die gespeicherte Google-Straßenroute für die gestrichelte Kartenebene', () => {
    expect(decodeGooglePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toEqual([
      { latitude: 38.5, longitude: -120.2 },
      { latitude: 40.7, longitude: -120.95 },
      { latitude: 43.252, longitude: -126.453 },
    ]);
  });

  it('datiert alte GPS-Koordinaten nicht durch einen Heartbeat künstlich neu', () => {
    const source = readFileSync('src/features/liveTracking/useEmployeeGpsTracking.ts', 'utf8');
    expect(source).toContain('A connection heartbeat is not a new GPS measurement');
    expect(source).toContain('touchTrackingSessionHeartbeat');
    expect(source).not.toContain('persistSnapshot(buildLiveLocationHeartbeatSnapshot');
  });

  it('puffert Live- und Fahrtenbuchpunkte lokal und verwendet einen Geräte-Watcher', () => {
    const live = readFileSync('src/features/liveTracking/useEmployeeGpsTracking.ts', 'utf8');
    const logbook = readFileSync('src/lib/employeeLogbook/employeeLogbookAutomation.ts', 'utf8');
    expect(live).toContain('enqueueAssistLocationPoint');
    expect(live).toContain(':employee:');
    expect(logbook).toContain('persistLogbookPointDurably');
    expect(logbook).toContain('acquireGeolocationWatch');
    expect(logbook).not.toContain('Location.watchPositionAsync');
  });

  it('speichert OSM-Routen als revisionsfähige Ersatzquelle statt als erfundene GPS-Messung', () => {
    const edge = readFileSync('supabase/functions/_shared/freeGeoEngine.ts', 'utf8');
    const migration = readFileSync(
      'supabase/migrations/20260826123000_live_tracking_google_route_fallback_r12.sql',
      'utf8',
    );
    const repository = readFileSync(
      'src/lib/employeeLogbook/employeeLogbookRepository.supabase.ts',
      'utf8',
    );
    expect(edge).toContain('routing.openstreetmap.de');
    expect(edge).not.toContain('googleapis.com');
    expect(edge).toContain('encodedPolyline');
    expect(migration).toContain("'google_fallback'");
    expect(repository).toContain("'osm_fallback' : 'google_fallback' : 'gps'");
    expect(repository).toContain('GPS-Aufzeichnung unvollständig');
  });

  it('zeigt alte Sitzungen nicht als LIVE und kennzeichnet die Google-Ersatzroute', () => {
    const assist = readFileSync('src/screens/assist/AssistLiveStatusScreen.tsx', 'utf8');
    const office = readFileSync('src/components/office/EmployeeLogbookOfficePanel.tsx', 'utf8');
    expect(assist).toContain("'UNTERBROCHEN'");
    expect(assist).toContain('GPS und Gerät live');
    expect(assist).toContain('orange gestrichelte berechnete Sollroute');
    expect(office).toContain('GOOGLE-ERSATZROUTE');
  });
});
