import { describe, expect, it, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { isGpsTrackingLiveReady } from '@/lib/assist/gpsTrackingConfig';
import {
  getCurrentGpsPosition,
  getGpsPermissionStatus,
  requestGpsForegroundPermission,
  startTripGpsSession,
} from '@/lib/assist/gpsLocationService';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

const locationMock = vi.hoisted(() => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: vi.fn(async () => ({ status: 'granted' })),
  getForegroundPermissionsAsync: vi.fn(async () => ({ status: 'granted' })),
  getCurrentPositionAsync: vi.fn(async () => ({
    coords: { latitude: 50.9375, longitude: 6.9603, accuracy: 12 },
    timestamp: Date.now(),
  })),
}));

vi.mock('expo-location', () => locationMock);

describe('gpsLocationService preparedOnly guards (Sprint 74)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('isGpsTrackingLiveReady bleibt false', () => {
    expect(isGpsTrackingLiveReady()).toBe(false);
  });

  it('gpsLocationService nutzt guardServiceTenant und blockGpsPreparedOnly', () => {
    const source = readSrc('src/lib/assist/gpsLocationService.ts');
    expect(source).toContain('guardServiceTenant');
    expect(source).toContain('blockGpsPreparedOnly');
    expect(source).toContain('isGpsTrackingLiveReady');
    expect(source).toContain('expo-location');
    expect(source).toContain('loadExpoLocation');
  });

  it('requestGpsForegroundPermission blockiert im preparedOnly-Modus', async () => {
    const result = await requestGpsForegroundPermission();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Vorbereitung');
    }
    expect(locationMock.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it('getCurrentGpsPosition blockiert im preparedOnly-Modus', async () => {
    const result = await getCurrentGpsPosition(DEMO_TENANT_ID, 'caregiver');
    expect(result.ok).toBe(false);
    expect(locationMock.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('startTripGpsSession blockiert im preparedOnly-Modus', async () => {
    const result = await startTripGpsSession('trip-001', DEMO_TENANT_ID, 'caregiver');
    expect(result.ok).toBe(false);
  });

  it('getGpsPermissionStatus liefert undetermined ohne Live-GPS', async () => {
    const result = await getGpsPermissionStatus();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBe('undetermined');
    }
    expect(locationMock.getForegroundPermissionsAsync).not.toHaveBeenCalled();
  });
});

describe('Assist GPS UI wiring (Sprint 74)', () => {
  it('TripsListView zeigt GPS-Vorbereitung-Banner', () => {
    const view = readSrc('src/components/assist/TripsListView.tsx');
    expect(view).toContain('isGpsTrackingLiveReady');
    expect(view).toContain('GPS_TRIPS_PREPARED_MESSAGE');
    expect(view).toContain('InfoBanner');
  });

  it('TripsListHero zeigt GPS-Badge', () => {
    const hero = readSrc('src/components/assist/TripsListHero.tsx');
    expect(hero).toContain('GPS extern');
    expect(hero).toContain('isGpsTrackingLiveReady');
  });

  it('gpsLocationService ist eigenständiger Assist-Service', () => {
    const service = readSrc('src/lib/assist/gpsLocationService.ts');
    expect(service).toContain('getCurrentGpsPosition');
    expect(service).toContain('startTripGpsSession');
    expect(service).toContain('getGpsPermissionStatus');
  });

  it('app.config.ts deklariert expo-location Plugin', () => {
    const appConfig = readSrc('app.config.ts');
    expect(appConfig).toContain('expo-location');
    expect(appConfig).toContain('isIosBackgroundLocationEnabled: false');
  });
});

describe('EAS readiness (Sprint 73)', () => {
  it('eas-preflight Script existiert', () => {
    expect(readSrc('scripts/eas-preflight.mjs')).toContain('eas project:init');
  });

  it('eas-preview-builds Doc existiert', () => {
    expect(readSrc('docs/deployment/eas-preview-builds.md')).toContain('NOT store-ready');
  });
});
