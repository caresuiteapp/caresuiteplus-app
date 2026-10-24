import { Text } from 'react-native';
import type { SemanticArtworkProps } from './semanticArtwork.types';
export type { SemanticArtworkProps } from './semanticArtwork.types';

/** Native compatibility: preserve the original element, props and children. */
export function SemanticArtwork({ webSize: _webSize, webColor: _webColor, ...textProps }: SemanticArtworkProps) {
  return <Text {...textProps} />;
}
