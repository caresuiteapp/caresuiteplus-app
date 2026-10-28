import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions, type DimensionValue, type LayoutChangeEvent, type ViewStyle } from 'react-native';
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
  const { deviceClass, isPhone, width } = useDeviceClass();
  const { fontScale } = useWindowDimensions();
  const [availableWidth, setAvailableWidth] = useState<number | null>(null);
  const scale = Math.max(1, fontScale || 1);
  const requestedColumns = columnOverrides?.[deviceClass] ?? kpiColumnsForDeviceClass(deviceClass);
  // Configured columns are an upper bound; the actual pane and system text
  // size determine how many readable cards fit beside one another.
  const readableColumns = Math.max(1, Math.floor(((availableWidth ?? width) + careSpacing.sm) / (160 * scale + careSpacing.sm)));
  const columnCount = Math.max(1, Math.min(requestedColumns, readableColumns));
  const measure = (event: LayoutChangeEvent) => {
    const measured = event.nativeEvent.layout.width;
    if (measured > 0) setAvailableWidth(previous => previous !== null && Math.abs(previous - measured) < 1 ? previous : measured);
  };
  const useHorizontalScroll = isPhone && phoneLayout === 'scroll' && items.length > columnCount;

  if (isPhone && phoneLayout === 'grid') {
    const rows = Array.from({ length: Math.ceil(items.length / columnCount) }, (_, row) =>
      items.slice(row * columnCount, (row + 1) * columnCount),
    );
    return (
      <View onLayout={measure} style={[styles.phoneGrid, style]}>
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
        onLayout={measure}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, style]}
      >
        {items.map((item) => (
          <View key={item.id} style={[styles.scrollItem, { width: 160 * scale }]}>
            {item.node}
          </View>
        ))}
      </ScrollView>
    );
  }

  const itemWidth = `${Math.floor(100 / columnCount) - 1}%`;

  return (
    <View onLayout={measure} style={[styles.grid, { gap: careSpacing.sm }, style]}>
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
