import manifest from './widgetRasterArtworkManifest.shared.json';
import type { WidgetRasterImages } from './widgetRasterArtworkAssets';

// The native static requires and Web URLs refer to the same files. Resolve
// bundled native asset IDs only on native; Web uses versioned public URLs.
export const WIDGET_RASTER_IMAGES: Record<string, WidgetRasterImages> = Object.fromEntries(
  manifest.artworks.map(artwork => [artwork.id, {
    small: { uri: artwork.variants.small.path },
    medium: { uri: artwork.variants.medium.path },
    large: { uri: artwork.variants.large.path },
  }]),
);
