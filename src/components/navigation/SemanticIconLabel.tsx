import { Text } from 'react-native';
import type { SemanticIconLabelProps } from './semanticIconLabel.types';

export type { SemanticIconLabelProps } from './semanticIconLabel.types';

/** Preserve the existing inline label exactly on native platforms. */
export function SemanticIconLabel({ symbol, label, webSize: _webSize, ...textProps }: SemanticIconLabelProps) {
  return <Text {...textProps}>{`${symbol} ${label}`}</Text>;
}
