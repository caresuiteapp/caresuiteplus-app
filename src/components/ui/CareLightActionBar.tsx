import { ReactNode, useMemo } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { careSpacing } from '@/design/tokens/spacing';
import {
  useCareLightPalette,
  type CareLightResolved,
} from '@/design/tokens/carelightadaptive';

type CareLightActionBarProps = {
  children: ReactNode;
  style?: ViewStyle;
};

export function CareLightActionBar({ children, style }: CareLightActionBarProps) {
  const { c } = useCareLightPalette();
  const styles = useMemo(() => makeStyles(c), [c]);
  return <View style={[styles.bar, style]}>{children}</View>;
}

function makeStyles(c: CareLightResolved) {
  return StyleSheet.create({
    bar: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: careSpacing.sm,
      paddingVertical: careSpacing.sm,
      borderTopWidth: 1,
      borderTopColor: c.border,
      backgroundColor: c.isDark ? 'transparent' : c.surface,
    },
  });
}
