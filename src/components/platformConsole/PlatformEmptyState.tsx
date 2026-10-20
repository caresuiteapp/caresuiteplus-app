import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PLATFORM_COLORS } from './PlatformColors';
import { spacing } from '@/theme';

type PlatformEmptyStateProps = {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function PlatformEmptyState({ title, message, actionLabel, onAction }: PlatformEmptyStateProps) {
  return (
    <View style={styles.wrap} accessibilityRole="text">
      <View style={styles.icon}><Text style={styles.iconText}>◇</Text></View>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <Pressable style={styles.action} onPress={onAction} accessibilityRole="button">
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
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
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
    marginVertical: spacing.xs,
    alignItems: 'center',
  },
  icon: { width: 42, height: 42, borderRadius: 21, backgroundColor: PLATFORM_COLORS.accentSoft, alignItems: 'center', justifyContent: 'center' },
  iconText: { color: PLATFORM_COLORS.accent, fontSize: 22, fontWeight: '800' },
  title: {
    color: PLATFORM_COLORS.text,
    fontWeight: '600',
    fontSize: 16,
    textAlign: 'center',
  },
  message: {
    color: PLATFORM_COLORS.muted,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  action: { marginTop: spacing.sm, borderRadius: 9, backgroundColor: PLATFORM_COLORS.accent, paddingHorizontal: spacing.md, paddingVertical: 9 },
  actionText: { color: '#FFFFFF', fontWeight: '700' },
});
