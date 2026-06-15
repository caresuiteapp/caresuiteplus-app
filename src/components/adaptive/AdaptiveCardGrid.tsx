import { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { careSpacing } from '@/design/tokens/spacing';
import { useResponsiveValue } from '@/hooks/useResponsiveValue';

type AdaptiveCardGridProps = {
  children: ReactNode;
  style?: ViewStyle;
  minItemWidth?: number;
};

export function AdaptiveCardGrid({ children, style, minItemWidth = 260 }: AdaptiveCardGridProps) {
  const columns = useResponsiveValue({
    phone: 1,
    tablet: 2,
    desktop: 2,
    wide: 2,
  });

  return (
    <View
      style={[
        styles.grid,
        {
          gap: careSpacing.md,
          flexDirection: columns === 1 ? 'column' : 'row',
          flexWrap: columns === 1 ? 'nowrap' : 'wrap',
        },
        style,
      ]}
    >
      {Array.isArray(children)
        ? children.map((child, index) => (
            <View
              key={index}
              style={[
                styles.cell,
                columns === 1
                  ? styles.cellFull
                  : { width: `${100 / columns - 2}%`, minWidth: minItemWidth },
              ]}
            >
              {child}
            </View>
          ))
        : children}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    width: '100%',
  },
  cell: {
    minWidth: 0,
    flexGrow: 1,
  },
  cellFull: {
    width: '100%',
  },
});
