import { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type DimensionValue, type ViewStyle } from 'react-native';
import {
  kpiColumnsForDeviceClass,
  kpiGridColumnCount,
  type AdaptiveDeviceClass,
} from '@/design/tokens/breakpoints';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { useDeviceClass } from '@/hooks/useDeviceClass';

/** Prevent vertical KPI label/value breaks inside grid cells. */
export const kpiNoBreakTextProps = {
  numberOfLines: 1,
  adjustsFontSizeToFit: true,
  minimumFontScale: 0.75,
} as const;

export const kpiValueTextStyle = careTypography.kpi;

export type KpiGridItem = {
  id: string;
  node: ReactNode;
};

type AdaptiveKpiGridProps = {
  items: KpiGridItem[];
  style?: ViewStyle;
  columns?: Partial<Record<AdaptiveDeviceClass, number>>;
  phoneLayout?: 'scroll' | 'grid';
};

export { kpiGridColumnCount };

export function AdaptiveKpiGrid({ items, style, columns: columnOverrides, phoneLayout = 'scroll' }: AdaptiveKpiGridProps) {
  const { deviceClass, isPhone } = useDeviceClass();
  const columnCount = columnOverrides?.[deviceClass] ?? kpiColumnsForDeviceClass(deviceClass);
  const useHorizontalScroll = isPhone && phoneLayout === 'scroll' && items.length > columnCount;

  if (isPhone && phoneLayout === 'grid') {
    const rows = Array.from({ length: Math.ceil(items.length / columnCount) }, (_, row) =>
      items.slice(row * columnCount, (row + 1) * columnCount),
    );
    return (
      <View style={[styles.phoneGrid, style]}>
        {rows.map((row) => (
          <View key={row[0].id} style={styles.phoneRow}>
            {Array.from({ length: columnCount }, (_, index) => (
              <View key={row[index]?.id ?? `empty-${index}`} style={styles.phoneItem}>
                {row[index]?.node}
              </View>
            ))}
          </View>
        ))}
      </View>
    );
  }

  if (useHorizontalScroll) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, style]}
      >
        {items.map((item) => (
          <View key={item.id} style={styles.scrollItem}>
            {item.node}
          </View>
        ))}
      </ScrollView>
    );
  }

  const itemWidth = `${Math.floor(100 / columnCount) - 1}%`;

  return (
    <View style={[styles.grid, { gap: careSpacing.sm }, style]}>
      {items.map((item) => (
        <View
          key={item.id}
          style={[styles.item, { width: itemWidth as DimensionValue, minWidth: isPhone ? 140 : 120 }]}
        >
          {item.node}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  phoneGrid: { width: '100%', gap: careSpacing.sm },
  phoneRow: { width: '100%', flexDirection: 'row', gap: careSpacing.sm, alignItems: 'stretch' },
  phoneItem: { flex: 1, minWidth: 0 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
  },
  item: {
    flexGrow: 1,
    minWidth: 0,
    overflow: 'hidden',
  },
  scroll: {
    flexDirection: 'row',
    gap: careSpacing.sm,
    paddingBottom: careSpacing.xs,
  },
  scrollItem: {
    width: 160,
    flexShrink: 0,
    overflow: 'hidden',
  },
});
