import { describe, expect, it } from 'vitest';
import {
  buildAssistMapImageUrl,
  buildOsmEmbedUrl,
  getAssistMapDemoPosition,
  isAssistMapProviderConfigured,
} from '@/lib/assist/assistMapProvider';

describe('assistMapProvider', () => {
  it('is configured by default via OpenStreetMap', () => {
    expect(isAssistMapProviderConfigured()).toBe(true);
  });

  it('builds OSM embed and static URLs without API keys', () => {
    const demo = getAssistMapDemoPosition();
    expect(buildOsmEmbedUrl(demo.latitude, demo.longitude)).toContain('openstreetmap.org');
    expect(buildAssistMapImageUrl(demo.latitude, demo.longitude)).toContain('staticmap');
  });
});
