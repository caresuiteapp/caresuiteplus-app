import type { CSSProperties } from 'react';
import { Image } from 'react-native';
import type { WidgetDefinition } from '../screens/administrationDesktopCatalog';
import { desktopCatalogArtwork } from './desktopCatalogArtworkModel.web';
import { desktopArtworkFrame } from './desktopArtworkGeometry.web';
import { desktopArtworkUri, selectDesktopArtworkAsset } from './desktopArtworkSource.web';

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
  const asset = selectDesktopArtworkAsset(artwork, size);
  const source = asset?.source ?? (typeof size === 'number' && size <= 48 ? artwork.small : artwork.medium);
  const uri = asset ? desktopArtworkUri(source,
    typeof Image.resolveAssetSource === 'function' ? Image.resolveAssetSource : undefined) : undefined;
  const frame = asset && uri ? desktopArtworkFrame(asset) : null;

  return <div className={['cs-desktop-catalog-artwork', className].filter(Boolean).join(' ')} aria-hidden="true" data-testid="desktop-catalog-artwork"
    data-artwork-route={route} data-artwork-label={label}
    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, minWidth: 0, flexShrink: 0, pointerEvents: 'none', ...style }}>
    {asset && uri && frame ? <svg aria-hidden="true" focusable="false" width="100%" height="100%"
      viewBox={`${frame.x} ${frame.y} ${frame.side} ${frame.side}`} preserveAspectRatio="xMidYMid meet"
      data-artwork-normalized="true" style={{ display: 'block', width: '100%', height: '100%', overflow: 'hidden' }}>
      <image href={uri} x={0} y={0} width={asset.pixelSize[0]} height={asset.pixelSize[1]} />
    </svg> : <Image source={source} resizeMode="contain" accessible={false}
      style={{ width: '100%', height: '100%' }}/>}
  </div>;
}
