import { describe, expect, it } from 'vitest';
import {
  buildAssistMapImageUrl,
  buildGoogleStaticMapUrl,
  buildOsmEmbedUrl,
  getAssistMapDemoPosition,
  getAssistMapTileSource,
  isAssistMapProviderConfigured,
  isGoogleMapsConfigured,
} from '@/lib/assist/assistMapProvider';

describe('assistMapProvider', () => {
  it('is configured by default via fallback providers', () => {
    expect(isAssistMapProviderConfigured()).toBe(true);
  });

  it('builds OSM embed and static URLs without API keys', () => {
    const demo = getAssistMapDemoPosition();
    expect(buildOsmEmbedUrl(demo.latitude, demo.longitude)).toContain('openstreetmap.org');
    expect(buildAssistMapImageUrl(demo.latitude, demo.longitude)).toContain('staticmap');
  });

  it('prefers google tile source when EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is set', () => {
    const prev = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = 'test-google-key';
    try {
      expect(isGoogleMapsConfigured()).toBe(true);
      expect(getAssistMapTileSource()).toBe('google');
      const demo = getAssistMapDemoPosition();
      const url = buildAssistMapImageUrl(demo.latitude, demo.longitude);
      expect(url).toContain('maps.googleapis.com');
      expect(buildGoogleStaticMapUrl(demo.latitude, demo.longitude, 'test-google-key')).toContain(
        'test-google-key',
      );
    } finally {
      if (prev === undefined) delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
      else process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = prev;
    }
  });
});
