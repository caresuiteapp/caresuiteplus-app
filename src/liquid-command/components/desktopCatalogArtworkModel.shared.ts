import type { ImageSourcePropType } from 'react-native';
import type { WidgetDefinition } from '../screens/administrationDesktopCatalog';
import { widgetArtworkIdentity } from './widgetArtworkIdentity.shared';
import { widgetArtworkTheme } from './widgetArtworkTheme.shared';
import { widgetArtworkSvg, WIDGET_ARTWORK_VERSION } from './widgetArtworkSvg.shared';
import { widgetRasterArtwork, WIDGET_RASTER_ARTWORK_VERSION } from './widgetRasterArtwork.shared';

export type DesktopCatalogArtworkImages = {
  small: ImageSourcePropType; medium: ImageSourcePropType; large: ImageSourcePropType;
};
const cache = new Map<string, DesktopCatalogArtworkImages>();

/** Aliases share one function; different functions never share a stock image. */
export function desktopCatalogArtworkName(route: string): string {
  if (widgetRasterArtwork(route)) return `${WIDGET_RASTER_ARTWORK_VERSION}:${widgetArtworkIdentity(route)}`;
  return `${WIDGET_ARTWORK_VERSION}:${widgetArtworkIdentity(route)}`;
}

export function desktopCatalogArtworkXml(route: string, label = ''): string {
  return widgetArtworkSvg(widgetArtworkTheme(route, label));
}

/** Recovered 3D masters take priority. Legacy props cannot reintroduce a
 * borrowed picture. Functions awaiting an original retain their own vector. */
export function desktopCatalogArtwork(
  route: string, _preferred?: WidgetDefinition['images'], label = '',
): DesktopCatalogArtworkImages {
  const original = widgetRasterArtwork(route);
  if (original) return original.images;
  const theme = widgetArtworkTheme(route, label);
  const key = `${theme.identity}:${theme.primary}:${theme.secondary}`;
  const existing = cache.get(key);
  if (existing) return existing;
  const source = { uri: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(widgetArtworkSvg(theme))}` };
  const images = { small: source, medium: source, large: source };
  if (cache.size >= 256) cache.delete(cache.keys().next().value!);
  cache.set(key, images);
  return images;
}
