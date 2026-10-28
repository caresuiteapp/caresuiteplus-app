// Generated native presentation from src/components/navigation/SemanticIconLabel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeSpan} from '@/components/layout/NativeWorkspaceElements.native';
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { StyleSheet } from 'react-native';
import { SemanticArtwork } from "../icons/SemanticArtwork.native.tsx";
import type { SemanticIconLabelProps } from './semanticIconLabel.types';
/** Use a predictable decorative icon while keeping the visible label and text style. */
export function SemanticIconLabel({ symbol, label, webSize = 16, style, ...textProps }: SemanticIconLabelProps) {
    const color = StyleSheet.flatten(style)?.color;
    return <NativeSpan style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0, maxWidth: '100%' }}>
    <SemanticArtwork webSize={webSize} style={color ? { color } : undefined}>{symbol}</SemanticArtwork>
    <Text {...textProps} style={[style, { flexShrink: 1, minWidth: 0 }]}>{label}</Text>
  </NativeSpan>;
}
