import type { CSSProperties } from 'react';
import type { WidgetDefinition } from '../screens/administrationDesktopCatalog';
import { desktopCatalogArtwork, desktopCatalogArtworkName } from './desktopCatalogArtworkModel.web';

export type DesktopCatalogArtworkProps = {
  route: string;
  label: string;
  images?: WidgetDefinition['images'];
  size?: number | string;
  className?: string;
  style?: CSSProperties;
};

/** Shared decorative artwork; the surrounding control provides its visible name. */
export function DesktopCatalogArtwork({
  route, label, images, size = '100%', className, style,
}: DesktopCatalogArtworkProps) {
  const artwork = desktopCatalogArtwork(route, images, label);
  const source = artwork.large as { uri: string };
  const small = artwork.small as { uri: string };
  const medium = artwork.medium as { uri: string };
  const raster = small.uri !== source.uri;
  const renderedSource = raster ? (typeof size === 'number' && size <= 64 ? small.uri : medium.uri) : source.uri;

  return <div className={['cs-desktop-catalog-artwork', className].filter(Boolean).join(' ')} aria-hidden="true" data-testid="desktop-catalog-artwork"
    data-artwork-route={route} data-artwork-label={label} data-artwork-name={desktopCatalogArtworkName(route)}
    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, minWidth: 0, flexShrink: 0, pointerEvents: 'none', ...style }}>
    <img src={renderedSource} srcSet={raster ? `${small.uri} 192w, ${medium.uri} 512w, ${source.uri} 1254w` : undefined}
      sizes={raster ? (typeof size === 'number' ? `${size}px` : '(max-width: 600px) 70vw, 400px') : undefined}
      alt="" draggable={false} decoding="async" data-artwork-normalized="true" data-artwork-kind={raster ? 'original-3d' : 'vector'}
      style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain' }}/>
  </div>;
}
