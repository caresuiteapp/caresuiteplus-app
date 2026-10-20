import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildAssistLiveRouteSummary } from '@/features/assistLive/getAssistLiveMonitoring';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Assist Live GPS-Streckenkarte R11', () => {
  it('trennt GPS-Lücken und berechnet keine Luftlinie über die Unterbrechung', () => {
    const route = buildAssistLiveRouteSummary([
      { latitude: 51.5000, longitude: 7.4000, accuracyMeters: 8, capturedAt: '2026-08-25T08:00:00.000Z' },
      { latitude: 51.5005, longitude: 7.4000, accuracyMeters: 8, capturedAt: '2026-08-25T08:01:00.000Z' },
      { latitude: 51.6000, longitude: 7.6000, accuracyMeters: 9, capturedAt: '2026-08-25T08:10:00.000Z' },
      { latitude: 51.6005, longitude: 7.6000, accuracyMeters: 9, capturedAt: '2026-08-25T08:11:00.000Z' },
    ]);

    expect(route.gapCount).toBe(1);
    expect(route.maxGapSeconds).toBe(540);
    expect(route.segments).toHaveLength(2);
    expect(route.segments.every((segment) => segment.length === 2)).toBe(true);
    expect(route.totalDistanceKm).toBeGreaterThan(0.1);
    expect(route.totalDistanceKm).toBeLessThan(0.2);
    expect(route.durationSeconds).toBe(660);
    expect(route.movementDurationSeconds).toBe(120);
    expect(route.averageSpeedKmh).toBeGreaterThan(3);
  });

  it('zeigt nur kontinuierliche GPS-Spuren und keine geodätischen Luftlinien', () => {
    const map = read('src/components/maps/GoogleMapsLiveMap.web.tsx');

    expect(map).toContain('resolvedRouteSegments');
    expect(map).toContain('geodesic: false');
    expect(map).not.toContain('geodesic: true');
    expect(map).toContain("fittedRouteRef.current !== fitKey");
  });

  it('überschreibt den manuellen Zoom nicht bei jedem Live-Update', () => {
    const markers = read('src/components/maps/useStableMapMarkers.ts');

    expect(markers).toContain('fittedMarkerSetRef.current !== markerSetKey');
    expect(markers).toContain('lastSelectedMarkerRef.current !== selectedMarkerId');
  });

  it('erzwingt einen lesbaren Kartenhinweis mit festen Kontrastfarben', () => {
    const map = read('src/components/maps/GoogleMapsLiveMap.web.tsx');

    expect(map).toContain('color:#102A43;background:#FFFFFF');
    expect(map).toContain('GPS ${escapeHtml(coordinates)}');
  });

  it('zeigt die detaillierte GPS-Streckenprüfung in der Oberfläche', () => {
    const screen = read('src/screens/assist/AssistLiveStatusScreen.tsx');

    expect(screen).toContain('GPS-STRECKENPRÜFUNG');
    expect(screen).toContain('Messdauer / Bewegung');
    expect(screen).toContain('GPS-Spuren / längste Lücke');
    expect(screen).toContain('nicht mehr durch Luftlinien verbunden');
  });
});
