import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ESCOOTER_WALKING_MAX_KM,
  formatTravelTimeLabel,
  formatTravelTimePlaceholder,
  mapTransportModeToGoogle,
} from '@/lib/maps/transportModeMapping';
import { resolveRouteStartAddress, resolveRouteEndAddress } from '@/lib/maps/employeeRouteEndpointResolver';
import {
  fetchTravelTime,
  resetTravelTimeCache,
} from '@/lib/maps/googleMapsTravelService';
import { buildDefaultMobilitySettings } from '@/lib/office/employeeMobilityService';

vi.mock('@/lib/supabase/edgeFunctions', () => ({
  invokeEdgeFunction: vi.fn(),
}));

import { invokeEdgeFunction } from '@/lib/supabase/edgeFunctions';

describe('transportModeMapping', () => {
  it('maps standard modes to Google travel modes', () => {
    expect(mapTransportModeToGoogle('car').googleMode).toBe('driving');
    expect(mapTransportModeToGoogle('transit').googleMode).toBe('transit');
    expect(mapTransportModeToGoogle('bicycle').googleMode).toBe('bicycling');
    expect(mapTransportModeToGoogle('walking').googleMode).toBe('walking');
  });

  it('maps E-Scooter to walking for short distances and bicycling otherwise', () => {
    expect(mapTransportModeToGoogle('escooter', ESCOOTER_WALKING_MAX_KM).googleMode).toBe('walking');
    expect(mapTransportModeToGoogle('escooter', ESCOOTER_WALKING_MAX_KM + 0.1).googleMode).toBe(
      'bicycling',
    );
    expect(mapTransportModeToGoogle('escooter').note).toContain('E-Scooter');
  });

  it('formatTravelTimeLabel returns German label with icon', () => {
    expect(formatTravelTimeLabel('car', 14)).toBe('🚗 14 Min.');
    expect(formatTravelTimeLabel('transit', null)).toBeNull();
  });

  it('formatTravelTimePlaceholder returns icon with em dash', () => {
    expect(formatTravelTimePlaceholder('car')).toBe('🚗 —');
  });
});

describe('employeeRouteEndpointResolver', () => {
  const settings = buildDefaultMobilitySettings('tenant-1', 'emp-1');
  const home = { street: 'Heimweg', houseNumber: '5', postalCode: '10115', city: 'Berlin' };
  const office = { street: 'Büroallee', houseNumber: '1', postalCode: '10117', city: 'Berlin' };

  it('resolves home and office route points', () => {
    expect(
      resolveRouteStartAddress({
        settings: { ...settings, routeStartType: 'home' },
        employeeHome: home,
        tenantOffice: office,
      }),
    ).toContain('Heimweg');
    expect(
      resolveRouteEndAddress({
        settings: { ...settings, routeEndType: 'office' },
        employeeHome: home,
        tenantOffice: office,
      }),
    ).toContain('Büroallee');
  });

  it('uses custom address when configured', () => {
    expect(
      resolveRouteStartAddress({
        settings: {
          ...settings,
          routeStartType: 'custom',
          routeStartAddress: 'Parkplatz Nord, 10115 Berlin',
        },
        employeeHome: home,
        tenantOffice: office,
      }),
    ).toBe('Parkplatz Nord, 10115 Berlin');
  });
});

describe('googleMapsTravelService', () => {
  beforeEach(() => {
    resetTravelTimeCache();
    vi.mocked(invokeEdgeFunction).mockReset();
  });

  it('returns unavailable when addresses are missing', async () => {
    const result = await fetchTravelTime({
      tenantId: 'tenant-1',
      origin: '',
      destination: 'Berlin',
      transportMode: 'car',
      allowHeuristicFallback: false,
    });
    expect(result.source).toBe('unavailable');
    expect(result.durationMinutes).toBeNull();
  });

  it('uses Google response when edge function succeeds', async () => {
    vi.mocked(invokeEdgeFunction).mockResolvedValue({
      ok: true,
      data: {
        ok: true,
        durationMinutes: 18,
        distanceMeters: 9200,
        googleMode: 'driving',
        note: null,
        source: 'google',
      },
    });

    const result = await fetchTravelTime({
      tenantId: 'tenant-1',
      origin: 'Berlin Hauptbahnhof',
      destination: 'Alexanderplatz, Berlin',
      transportMode: 'car',
    });

    expect(result.durationMinutes).toBe(18);
    expect(result.source).toBe('google');
  });

  it('falls back to heuristic when edge function has no API key', async () => {
    vi.mocked(invokeEdgeFunction).mockResolvedValue({
      ok: true,
      data: {
        ok: true,
        durationMinutes: null,
        distanceMeters: null,
        googleMode: 'driving',
        note: 'Google Maps API-Schlüssel nicht konfiguriert.',
        source: 'unavailable',
      },
    });

    const result = await fetchTravelTime({
      tenantId: 'tenant-1',
      origin: '10115 Berlin',
      destination: '10117 Berlin',
      transportMode: 'car',
    });

    expect(result.source).toBe('heuristic');
    expect(result.durationMinutes).toBeGreaterThan(0);
  });

  it('caches identical origin-destination-mode requests', async () => {
    vi.mocked(invokeEdgeFunction).mockResolvedValue({
      ok: true,
      data: {
        ok: true,
        durationMinutes: 12,
        distanceMeters: 5000,
        googleMode: 'driving',
        note: null,
        source: 'google',
      },
    });

    await fetchTravelTime({
      tenantId: 'tenant-1',
      origin: 'A',
      destination: 'B',
      transportMode: 'car',
    });
    await fetchTravelTime({
      tenantId: 'tenant-1',
      origin: 'A',
      destination: 'B',
      transportMode: 'car',
    });

    expect(invokeEdgeFunction).toHaveBeenCalledTimes(1);
  });
});
