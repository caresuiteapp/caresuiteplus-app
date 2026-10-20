import { describe, expect, it } from 'vitest';
import { resetGoogleMapsLoaderForTests } from '@/lib/maps/googleMapsLoader';

describe('googleMapsLoader', () => {
  it('resetGoogleMapsLoaderForTests is callable', () => {
    expect(() => resetGoogleMapsLoaderForTests()).not.toThrow();
  });

  it('loadGoogleMapsApi rejects outside browser context', async () => {
    const { loadGoogleMapsApi } = await import('@/lib/maps/googleMapsLoader');
    await expect(loadGoogleMapsApi('test-key')).rejects.toThrow(/Browser/i);
  });
});
