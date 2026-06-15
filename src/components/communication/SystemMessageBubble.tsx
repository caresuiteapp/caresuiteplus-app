import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';

type SystemMessageBubbleProps = { text: string };

export function SystemMessageBubble({ text }: SystemMessageBubbleProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', marginVertical: spacing.sm },
  text: {
    ...typography.caption,
    color: colors.textSecondary,
    backgroundColor: colors.bgPanel,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.capsule,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
});
