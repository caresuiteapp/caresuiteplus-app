import manifest from './widgetRasterArtworkManifest.shared.json';
import { WIDGET_RASTER_IMAGES } from './widgetRasterArtworkAssets';
import { widgetArtworkIdentity } from './widgetArtworkIdentity.shared';

export const WIDGET_RASTER_ARTWORK_VERSION = manifest.version;
const byIdentity = new Map(manifest.artworks.map(artwork => [artwork.identity, artwork]));

/** Exact function match: a parent page's image is never borrowed by a child. */
export function widgetRasterArtwork(route: string) {
  const original = byIdentity.get(widgetArtworkIdentity(route));
  if (!original) return undefined;
  const images = WIDGET_RASTER_IMAGES[original.id];
  return images ? { ...original, images } : undefined;
}
