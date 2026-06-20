import { describe, expect, it } from 'vitest';
import {
  distanceMetersBetween,
  runGeofenceSoftCheck,
  clampGeofenceToleranceMeters,
} from '@/lib/assist/geofenceSoftCheck';

describe('geofenceSoftCheck', () => {
  it('clampGeofenceToleranceMeters hält 50–250 m ein', () => {
    expect(clampGeofenceToleranceMeters(10)).toBe(50);
    expect(clampGeofenceToleranceMeters(150)).toBe(150);
    expect(clampGeofenceToleranceMeters(500)).toBe(250);
  });

  it('distanceMetersBetween liefert ~0 für gleiche Koordinate', () => {
    const c = { latitude: 52.52, longitude: 13.405 };
    expect(distanceMetersBetween(c, c)).toBeLessThan(1);
  });

  it('runGeofenceSoftCheck überspringt ohne Zielkoordinaten', () => {
    const result = runGeofenceSoftCheck({
      current: { latitude: 52.52, longitude: 13.405 },
      target: null,
    });
    expect(result.checked).toBe(false);
    expect(result.skippedReason).toContain('Zielkoordinaten');
  });

  it('runGeofenceSoftCheck warnt außerhalb Toleranz', () => {
    const result = runGeofenceSoftCheck({
      current: { latitude: 52.52, longitude: 13.405 },
      target: { latitude: 52.53, longitude: 13.42 },
      toleranceMeters: 100,
    });
    expect(result.checked).toBe(true);
    expect(result.insideTolerance).toBe(false);
    expect(result.warning).toContain('m vom Einsatzort');
  });

  it('runGeofenceSoftCheck erlaubt Override', () => {
    const result = runGeofenceSoftCheck({
      current: { latitude: 52.52, longitude: 13.405 },
      target: { latitude: 52.53, longitude: 13.42 },
      toleranceMeters: 100,
      overrideReason: 'Parkplatz Seitenstraße',
    });
    expect(result.overridden).toBe(true);
    expect(result.warning).toContain('Override');
  });
});
