import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { DesktopCatalogArtwork } from '@/liquid-command/components/DesktopCatalogArtwork';
import { SpaceKpiIcon } from './space/SpaceKpiIcon';
import { isSpaceGlyphKind } from './space/spaceIconRegistry';
import { resolveSemanticArtwork, SEMANTIC_VECTOR_PATHS } from './semanticArtworkModel.shared';
import type { SemanticArtworkProps } from './semanticArtwork.types';
export type { SemanticArtworkProps } from './semanticArtwork.types';

/** Explicit icon slots share their meaning, artwork and optical size with Web. */
export function SemanticArtwork({ webSize = 40, webColor, ...props }: SemanticArtworkProps) {
  const artwork = resolveSemanticArtwork(props.children);
  const spaceGlyph = typeof props.children === 'string' && isSpaceGlyphKind(props.children) ? props.children : null;
  if (!artwork && !spaceGlyph) return <Text {...props} />;
  const size = Number.isFinite(webSize) && webSize > 0 ? webSize : 40;
  const original = StyleSheet.flatten(props.style);
  const color = webColor ?? original?.color ?? '#1676c8';
  const layout: ViewStyle = { width: size, height: size, flexShrink: 0, alignItems: 'center', justifyContent: 'center' };
  for (const key of ['width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight', 'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'marginHorizontal', 'marginVertical', 'alignSelf', 'opacity', 'display'] as const) {
    if (original?.[key] !== undefined) Object.assign(layout, { [key]: original[key] });
  }
  return <View accessible={false} pointerEvents="none" testID={props.testID} nativeID={props.nativeID} style={layout}>
    {artwork && 'route' in artwork ? <DesktopCatalogArtwork route={artwork.route} label="" size={size} style={{ maxWidth: '100%', maxHeight: '100%' }} />
      : artwork && 'vector' in artwork ? <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Path d={SEMANTIC_VECTOR_PATHS[artwork.vector]} /></Svg>
      : <SpaceKpiIcon icon={spaceGlyph!} size={size} accentColor={typeof color === 'string' ? color : '#1676c8'} frame="rail" />}
  </View>;
}
