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

  it('keeps the free map provider when an obsolete Google key is present', () => {
    const prev = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = 'test-google-key';
    try {
      expect(isGoogleMapsConfigured()).toBe(false);
      expect(getAssistMapTileSource()).toBe('osm');
      const demo = getAssistMapDemoPosition();
      const url = buildAssistMapImageUrl(demo.latitude, demo.longitude);
      expect(url).toContain('staticmap.openstreetmap.de');
      expect(url).not.toContain('test-google-key');
      const legacyUrl = buildGoogleStaticMapUrl(demo.latitude, demo.longitude, 'test-google-key');
      expect(legacyUrl).toContain('staticmap.openstreetmap.de');
      expect(legacyUrl).not.toContain('test-google-key');
    } finally {
      if (prev === undefined) delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
      else process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = prev;
    }
  });
});
