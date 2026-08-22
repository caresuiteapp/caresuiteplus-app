import { describe, expect, it } from 'vitest';
import { calculateTrackDistanceKm, calculateTripFinancials, haversineDistanceKm, isApproachRoute } from '@/lib/employeeLogbook/employeeLogbookMath';

describe('Mitarbeiter-Fahrtenbuch R1', () => {
  it('berechnet GPS-Distanzen stabil in Kilometern', () => {
    const km = haversineDistanceKm({ latitude: 52.52, longitude: 13.405 }, { latitude: 52.5209, longitude: 13.405 });
    expect(km).toBeGreaterThan(0.09); expect(km).toBeLessThan(0.11);
  });
  it('ignoriert ungenaue GPS-Sprünge und unrealistische Segmente', () => {
    expect(calculateTrackDistanceKm([
      { latitude: 52.52, longitude: 13.405, accuracy: 8, recordedAt: '2026-08-22T08:00:00Z' },
      { latitude: 52.521, longitude: 13.405, accuracy: 8, recordedAt: '2026-08-22T08:01:00Z' },
      { latitude: 48.137, longitude: 11.575, accuracy: 300, recordedAt: '2026-08-22T08:02:00Z' },
    ])).toBeCloseTo(0.11, 1);
  });
  it('vergütet Kilometer und zieht unbezahlte Anfahrtszeit ab', () => {
    expect(calculateTripFinancials({ distanceKm: 12.5, rateCents: 35, durationSeconds: 1850, countsAsWorkTime: false })).toEqual({ mileageAmountCents: 438, worktimeDeductionMinutes: 31 });
  });
  it('klassifiziert erste und letzte Anfahrt als Fahrzeit außerhalb Arbeitszeit', () => {
    expect(isApproachRoute('home_to_client')).toBe(true); expect(isApproachRoute('client_to_home')).toBe(true); expect(isApproachRoute('client_to_client')).toBe(false);
  });
});
