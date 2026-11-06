import { useMemo } from 'react';
import { Image, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import type { WidgetDefinition } from '../screens/administrationDesktopCatalog';
import { desktopCatalogArtworkXml } from './desktopCatalogArtworkModel.shared';
import { widgetRasterArtwork } from './widgetRasterArtwork.shared';

type Props = {
  route: string;
  label: string;
  images?: WidgetDefinition['images'];
  size?: DimensionValue;
  style?: StyleProp<ViewStyle>;
};

/** Native bundles the same 3D masters and derivatives served on the Web. */
export function DesktopCatalogArtwork({ route, label, size = '100%', style }: Props) {
  const original = widgetRasterArtwork(route);
  const xml = useMemo(() => original ? '' : desktopCatalogArtworkXml(route, label), [route, label, Boolean(original)]);
  const source = original?.images[typeof size === 'number' && size <= 64 ? 'small' : typeof size === 'number' && size <= 256 ? 'medium' : 'large'];
  return <View testID="desktop-catalog-artwork" accessible={false} pointerEvents="none"
    style={[{ width: size, height: size, minWidth: 0, flexShrink: 0, alignItems: 'center', justifyContent: 'center' }, style]}>
    {source ? <Image source={source} resizeMode="contain" accessible={false} style={{ width: '100%', height: '100%' }} />
      : <SvgXml xml={xml} width="100%" height="100%" />}
  </View>;
}
