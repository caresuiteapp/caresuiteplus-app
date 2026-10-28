import { Image, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Image as SvgImage } from 'react-native-svg';
import type { WidgetDefinition } from '../screens/administrationDesktopCatalog';
import { desktopCatalogArtwork } from './desktopCatalogArtworkModel.shared';
import { desktopArtworkFrame } from './desktopArtworkGeometry.shared';
import { desktopArtworkUri, selectDesktopArtworkAsset } from './desktopArtworkSource.shared';

type Props = {
  route: string;
  label: string;
  images?: WidgetDefinition['images'];
  size?: DimensionValue;
  style?: StyleProp<ViewStyle>;
};

/** Native SVG uses the exact source and crop used by the Web catalogue. */
export function DesktopCatalogArtwork({ route, images, size = '100%', style }: Props) {
  const artwork = desktopCatalogArtwork(route, images);
  const asset = selectDesktopArtworkAsset(artwork, typeof size === 'number' ? size : '100%');
  const source = asset?.source ?? (typeof size === 'number' && size <= 48 ? artwork.small : artwork.medium);
  const uri = desktopArtworkUri(source, Image.resolveAssetSource);
  const frame = asset ? desktopArtworkFrame(asset) : null;
  return <View testID="desktop-catalog-artwork" accessible={false} pointerEvents="none"
    style={[{ width: size, height: size, minWidth: 0, flexShrink: 0, alignItems: 'center', justifyContent: 'center' }, style]}>
    {frame && asset && uri ? <Svg width="100%" height="100%" viewBox={`${frame.x} ${frame.y} ${frame.side} ${frame.side}`} preserveAspectRatio="xMidYMid meet">
      <SvgImage href={{ uri }} x={0} y={0} width={asset.pixelSize[0]} height={asset.pixelSize[1]} />
    </Svg> : <Image source={source} resizeMode="contain" accessible={false} style={{ width: '100%', height: '100%' }} />}
  </View>;
}
