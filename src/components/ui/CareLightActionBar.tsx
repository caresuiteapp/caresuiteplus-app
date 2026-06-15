import { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { careLightColors } from '@/design/tokens/lightTheme';
import { careSpacing } from '@/design/tokens/spacing';

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
    paddingVertical: careSpacing.sm,
    borderTopWidth: 1,
    borderTopColor: careLightColors.border,
    backgroundColor: careLightColors.surface,
  },
});
