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

  return <div className={['cs-desktop-catalog-artwork', className].filter(Boolean).join(' ')} aria-hidden="true" data-testid="desktop-catalog-artwork"
    data-artwork-route={route} data-artwork-label={label} data-artwork-name={desktopCatalogArtworkName(route)}
    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, minWidth: 0, flexShrink: 0, pointerEvents: 'none', ...style }}>
    <img src={source.uri} alt="" draggable={false} decoding="async" data-artwork-normalized="true"
      style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain' }}/>
  </div>;
}
