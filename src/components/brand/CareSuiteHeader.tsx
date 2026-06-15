import { ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { colors, spacing, typography } from '@/theme';
import { CareSuiteWordmark } from './CareSuiteWordmark';

type CareSuiteHeaderProps = {
  title?: string;
  subtitle?: string;
  rightSlot?: ReactNode;
  showWordmark?: boolean;
  style?: ViewStyle;
};

export function CareSuiteHeader({
  title,
  subtitle,
  rightSlot,
  showWordmark = true,
  style,
}: CareSuiteHeaderProps) {
  return (
    <View style={[styles.root, style]}>
      <View style={styles.left}>
        {showWordmark ? <CareSuiteWordmark size="sm" /> : null}
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {rightSlot ? <View style={styles.right}>{rightSlot}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  left: {
    flex: 1,
    gap: spacing.xs,
  },
  right: {
    flexShrink: 0,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
