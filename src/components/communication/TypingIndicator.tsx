import { StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '@/theme';

type TypingIndicatorProps = { visible?: boolean; label?: string };

export function TypingIndicator({ visible = false, label = 'schreibt…' }: TypingIndicatorProps) {
  if (!visible) return null;
  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingVertical: 4 },
  text: { ...typography.caption, color: colors.cyan, fontStyle: 'italic' },
});
