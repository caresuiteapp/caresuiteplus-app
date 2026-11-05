import { useMemo } from 'react';
import { View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import type { WidgetDefinition } from '../screens/administrationDesktopCatalog';
import { desktopCatalogArtworkXml } from './desktopCatalogArtworkModel.shared';

type Props = {
  route: string;
  label: string;
  images?: WidgetDefinition['images'];
  size?: DimensionValue;
  style?: StyleProp<ViewStyle>;
};

/** Native SVG uses the exact source and crop used by the Web catalogue. */
export function DesktopCatalogArtwork({ route, label, size = '100%', style }: Props) {
  const xml = useMemo(() => desktopCatalogArtworkXml(route, label), [route, label]);
  return <View testID="desktop-catalog-artwork" accessible={false} pointerEvents="none"
    style={[{ width: size, height: size, minWidth: 0, flexShrink: 0, alignItems: 'center', justifyContent: 'center' }, style]}>
    <SvgXml xml={xml} width="100%" height="100%" />
  </View>;
}
