import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { colors, spacing, typography } from '@/theme';

type Orientation = 'horizontal' | 'vertical';
type Variant = 'subtle' | 'strong';

type Props = {
  label?: string;
  orientation?: Orientation;
  variant?: Variant;
  style?: ViewStyle;
};

export function PremiumDivider({
  label,
  orientation = 'horizontal',
  variant = 'subtle',
  style,
}: Props) {
  const lineColor = variant === 'strong' ? colors.borderStrong : colors.borderSoft;

  if (orientation === 'vertical') {
    return (
      <View
        style={[styles.vertical, { backgroundColor: lineColor }, style]}
        accessibilityRole="none"
      />
    );
  }

  if (label) {
    return (
      <View style={[styles.labeledRow, style]}>
        <View style={[styles.line, { backgroundColor: lineColor }]} />
        <Text style={styles.label}>{label}</Text>
        <View style={[styles.line, { backgroundColor: lineColor }]} />
      </View>
    );
  }

  return (
    <View
      style={[styles.horizontal, { backgroundColor: lineColor }, style]}
      accessibilityRole="none"
    />
  );
}

const styles = StyleSheet.create({
  horizontal: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  vertical: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
  },
  labeledRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    width: '100%',
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  label: {
    ...typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});
