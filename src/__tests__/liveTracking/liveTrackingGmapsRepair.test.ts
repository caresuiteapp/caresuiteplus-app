import { describe, expect, it } from 'vitest';
import { resetGoogleMapsBrowserKeyCacheForTests } from '@/lib/maps/getGoogleMapsBrowserKey';

describe('getGoogleMapsBrowserKey', () => {
  it('returns EXPO_PUBLIC key when set', async () => {
    resetGoogleMapsBrowserKeyCacheForTests();
    const original = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = 'test-expo-key';
    const { getGoogleMapsBrowserKey } = await import('@/lib/maps/getGoogleMapsBrowserKey');
    const key = await getGoogleMapsBrowserKey();
    expect(key).toBe('test-expo-key');
    if (original === undefined) delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    else process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = original;
    resetGoogleMapsBrowserKeyCacheForTests();
  });
});

describe('resolveLiveAssignment', () => {
  it('rejects non-uuid ids gracefully', async () => {
    const { resolveLiveAssignment } = await import('@/features/liveTracking/resolveLiveAssignment');
    const result = await resolveLiveAssignment({
      tenantId: '00000000-0000-0000-0000-000000000001',
      rawId: 'not-a-uuid',
    });
    expect(result.ok && result.data === null).toBe(true);
  });
});

describe('getAssistLiveStatus', () => {
  it('exports formatTimerSeconds', async () => {
    const { formatTimerSeconds } = await import('@/features/liveTracking/getAssistLiveStatus');
    expect(formatTimerSeconds(125)).toBe('2:05');
    expect(formatTimerSeconds(null)).toBe('—');
  });

  it('berechnet eine GPS-Route mit Distanz und Bewegungsarten', async () => {
    const { buildAssistLiveRouteSummary } = await import(
      '@/features/assistLive/getAssistLiveMonitoring'
    );
    const route = buildAssistLiveRouteSummary([
      { latitude: 51.5000, longitude: 7.4000, accuracyMeters: 8, capturedAt: '2026-08-10T08:00:00.000Z' },
      { latitude: 51.5005, longitude: 7.4000, accuracyMeters: 7, capturedAt: '2026-08-10T08:01:00.000Z' },
      { latitude: 51.5050, longitude: 7.4000, accuracyMeters: 9, capturedAt: '2026-08-10T08:02:00.000Z' },
    ]);

    expect(route.pointCount).toBe(3);
    expect(route.totalDistanceKm).toBeGreaterThan(0.5);
    expect(route.walkingDistanceKm).toBeGreaterThan(0);
    expect(route.drivingDistanceKm).toBeGreaterThan(0);
  });
});
