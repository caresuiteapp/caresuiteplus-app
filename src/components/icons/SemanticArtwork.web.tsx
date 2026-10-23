import type { CSSProperties } from 'react';
import { StyleSheet, Text, type TextStyle } from 'react-native';
import { DesktopCatalogArtwork } from '@/liquid-command/components/DesktopCatalogArtwork.web';
import { WebActionIcon } from './WebActionIcon.web';
import { SpaceKpiIcon } from './space/SpaceKpiIcon.web';
import { isSpaceGlyphKind } from './space/spaceIconRegistry';
import { resolveSemanticArtwork, SEMANTIC_VECTOR_PATHS } from './semanticArtworkModel.web';
import type { SemanticArtworkProps } from './semanticArtwork.types';
export type { SemanticArtworkProps } from './semanticArtwork.types';

/** Keep an existing icon slot's layout and active/disabled color, not its font metrics. */
function slotStyle(style: TextStyle | undefined, size: number, color?: TextStyle['color']): CSSProperties {
  const layout: CSSProperties & { '--cs-action-icon-size': string } = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: size, height: size, flexShrink: 0, verticalAlign: 'middle',
    color: '#1676c8', pointerEvents: 'none',
    '--cs-action-icon-size': `${size}px`,
  };
  if (!style) {
    if (typeof color === 'string') layout.color = color;
    return layout;
  }
  for (const key of ['width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight',
    'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
    'alignSelf', 'opacity', 'display', 'color'] as const) {
    const value = style[key];
    if (typeof value === 'number' || typeof value === 'string') {
      Object.assign(layout, { [key]: value });
    }
  }
  if (style.marginHorizontal !== undefined) {
    layout.marginLeft = style.marginHorizontal as CSSProperties['marginLeft'];
    layout.marginRight = style.marginHorizontal as CSSProperties['marginRight'];
  }
  if (style.marginVertical !== undefined) {
    layout.marginTop = style.marginVertical as CSSProperties['marginTop'];
    layout.marginBottom = style.marginVertical as CSSProperties['marginBottom'];
  }
  if (typeof color === 'string') layout.color = color;
  return layout;
}

/** Stable web illustrations for explicit decorative slots; never rewrites arbitrary text. */
export function SemanticArtwork({ webSize = 40, webColor, ...textProps }: SemanticArtworkProps) {
  const { children, style, testID, nativeID } = textProps;
  const artwork = resolveSemanticArtwork(children);
  const spaceGlyph = typeof children === 'string' && isSpaceGlyphKind(children) ? children : null;
  if (!artwork && !spaceGlyph) return <Text {...textProps} />;
  const size = Number.isFinite(webSize) && webSize > 0 ? webSize : 40;
  const layout = slotStyle(StyleSheet.flatten(style), size, webColor);
  return <span aria-hidden="true" id={nativeID} data-testid={testID}
    data-semantic-artwork="true" style={layout}>
    {artwork && 'route' in artwork
      ? <DesktopCatalogArtwork route={artwork.route} label="" size={size} style={{ maxWidth: '100%', maxHeight: '100%' }} />
      : artwork && 'vector' in artwork
        ? <WebActionIcon size={size} style={{ maxWidth: '100%', maxHeight: '100%' }}><path d={SEMANTIC_VECTOR_PATHS[artwork.vector]} /></WebActionIcon>
        : <SpaceKpiIcon icon={spaceGlyph!} size={size} accentColor={layout.color === 'currentColor' ? '#1676c8' : layout.color ?? '#1676c8'} frame="rail" />}
  </span>;
}
