import { StyleSheet, Text, View } from 'react-native';
import { PLATFORM_COLORS } from './PlatformShellLayout';
import { spacing } from '@/theme';

type PlatformEmptyStateProps = {
  title: string;
  message?: string;
};

export function PlatformEmptyState({ title, message }: PlatformEmptyStateProps) {
  return (
    <View style={styles.wrap} accessibilityRole="text">
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
    backgroundColor: PLATFORM_COLORS.panel,
    borderWidth: 1,
    borderColor: PLATFORM_COLORS.border,
    borderRadius: 10,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
    marginVertical: spacing.xs,
  },
  title: {
    color: PLATFORM_COLORS.text,
    fontWeight: '600',
    fontSize: 14,
  },
  message: {
    color: PLATFORM_COLORS.muted,
    fontSize: 13,
    lineHeight: 18,
  },
});
