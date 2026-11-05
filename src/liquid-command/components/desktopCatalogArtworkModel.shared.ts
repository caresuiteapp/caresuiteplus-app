import type { ImageSourcePropType } from 'react-native';
import type { WidgetDefinition } from '../screens/administrationDesktopCatalog';
import { widgetArtworkIdentity } from './widgetArtworkIdentity.shared';
import { widgetArtworkTheme } from './widgetArtworkTheme.shared';
import { widgetArtworkSvg, WIDGET_ARTWORK_VERSION } from './widgetArtworkSvg.shared';

export type DesktopCatalogArtworkImages = {
  small: ImageSourcePropType; medium: ImageSourcePropType; large: ImageSourcePropType;
};
const cache = new Map<string, DesktopCatalogArtworkImages>();

/** Aliases share one function; different functions never share a stock image. */
export function desktopCatalogArtworkName(route: string): string {
  return `${WIDGET_ARTWORK_VERSION}:${widgetArtworkIdentity(route)}`;
}

export function desktopCatalogArtworkXml(route: string, label = ''): string {
  return widgetArtworkSvg(widgetArtworkTheme(route, label));
}

/** Legacy picture props cannot reintroduce an unrelated or duplicated motif.
 * The 2048 px SVG master scales losslessly at every size and pixel density. */
export function desktopCatalogArtwork(
  route: string, _preferred?: WidgetDefinition['images'], label = '',
): DesktopCatalogArtworkImages {
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
