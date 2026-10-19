import type { CSSProperties } from 'react';
import { Image } from 'react-native';
import type { WidgetDefinition } from '../screens/administrationDesktopCatalog';
import { desktopCatalogArtwork } from './desktopCatalogArtworkModel.web';

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
  const artwork = desktopCatalogArtwork(route, images);

  return <div className={['cs-desktop-catalog-artwork', className].filter(Boolean).join(' ')} aria-hidden="true" data-testid="desktop-catalog-artwork"
    data-artwork-route={route} data-artwork-label={label}
    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, minWidth: 0, flexShrink: 0, pointerEvents: 'none', ...style }}>
    <Image source={typeof size === 'number' && size <= 48 ? artwork.small : artwork.medium} resizeMode="contain" accessible={false}
      style={{ width: '100%', height: '100%' }}/>
  </div>;
}
