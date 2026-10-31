import { StyleSheet, Text, View } from 'react-native';
import { SemanticArtwork } from '@/components/icons/SemanticArtwork';
import type { SemanticIconLabelProps } from './semanticIconLabel.types';
export type { SemanticIconLabelProps } from './semanticIconLabel.types';

export function SemanticIconLabel({ symbol, label, webSize = 16, style, ...textProps }: SemanticIconLabelProps) {
  const color = StyleSheet.flatten(style)?.color;
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0, maxWidth: '100%' }}>
    <SemanticArtwork webSize={webSize} style={color ? { color } : undefined}>{symbol}</SemanticArtwork>
    <Text {...textProps} style={[style, { flexShrink: 1, minWidth: 0 }]}>{label}</Text>
  </View>;
}
