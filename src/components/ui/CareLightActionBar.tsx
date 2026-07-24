import { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { careSpacing } from '@/design/tokens/spacing';
import { systemLiquidGlass } from '@/design/tokens/systemLiquidGlass';

type CareLightActionBarProps = {
  children: ReactNode;
  style?: ViewStyle;
};

export function CareLightActionBar({ children, style }: CareLightActionBarProps) {
  return <View style={[styles.bar, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: careSpacing.sm,
    padding: careSpacing.sm,
    borderWidth: 1,
    borderColor: systemLiquidGlass.border,
    borderRadius: 16,
    backgroundColor: systemLiquidGlass.panel,
  },
});
