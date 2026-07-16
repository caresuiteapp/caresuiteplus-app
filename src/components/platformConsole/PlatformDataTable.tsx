import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { PLATFORM_COLORS } from './PlatformColors';
import { PlatformEmptyState } from './PlatformEmptyState';
import { spacing } from '@/theme';

export type PlatformDataTableColumn<T> = {
  key: string;
  label: string;
  flex?: number;
  width?: number;
  minWidth?: number;
  align?: 'left' | 'center' | 'right';
  render: (item: T) => React.ReactNode;
};

type PlatformDataTableProps<T> = {
  columns: PlatformDataTableColumn<T>[];
  data: T[];
  keyExtractor: (item: T, index: number) => string;
  selectedId?: string | null;
  onRowPress?: (item: T) => void;
  emptyTitle?: string;
  emptyMessage?: string;
  minTableWidth?: number;
};

function columnCellStyle<T>(col: PlatformDataTableColumn<T>): ViewStyle[] {
  const styles: ViewStyle[] = [];
  if (col.width != null) {
    styles.push({ width: col.width, minWidth: col.width, flexShrink: 0, flexGrow: 0 });
  } else if (col.flex != null) {
    styles.push({ flex: col.flex, minWidth: col.minWidth ?? 0 });
  } else if (col.minWidth != null) {
    styles.push({ minWidth: col.minWidth, flexShrink: 0 });
  }
  if (col.align === 'center') styles.push({ alignItems: 'center' });
  if (col.align === 'right') styles.push({ alignItems: 'flex-end' });
  return styles;
}

function resolveMinTableWidth<T>(columns: PlatformDataTableColumn<T>[]): number {
  return columns.reduce((sum, col) => {
    if (col.width != null) return sum + col.width;
    if (col.minWidth != null) return sum + col.minWidth;
    return sum + 96;
  }, 0);
}

export function PlatformDataTable<T>({
  columns,
  data,
  keyExtractor,
  selectedId = null,
  onRowPress,
  emptyTitle = 'Keine Einträge',
  emptyMessage,
  minTableWidth,
}: PlatformDataTableProps<T>) {
  const resolvedMinWidth = minTableWidth ?? resolveMinTableWidth(columns);

  if (data.length === 0) {
    return <PlatformEmptyState title={emptyTitle} message={emptyMessage} />;
  }

  const tableBody = (
    <View style={[styles.table, { minWidth: resolvedMinWidth }]} testID="platform-table">
      <View style={styles.headerRow}>
        {columns.map((col) => (
          <View key={col.key} style={[styles.headerCell, ...columnCellStyle(col)]}>
            <Text style={styles.headerText} numberOfLines={1}>
              {col.label}
            </Text>
          </View>
        ))}
      </View>

      {data.map((item, index) => {
        const id = keyExtractor(item, index);
        const selected = selectedId === id;
        const row = (
          <View style={[styles.dataRow, index % 2 === 1 ? styles.dataRowAlt : null, selected ? styles.dataRowSelected : null]}>
            {columns.map((col) => {
              const cell = col.render(item);
              return (
                <View key={col.key} style={[styles.dataCell, ...columnCellStyle(col)]}>
                  {typeof cell === 'string' || typeof cell === 'number' ? (
                    <Text style={styles.cellText} numberOfLines={2}>
                      {cell}
                    </Text>
                  ) : (
                    cell
                  )}
                </View>
              );
            })}
          </View>
        );

        if (!onRowPress) return <View key={id}>{row}</View>;

        return (
          <Pressable key={id} onPress={() => onRowPress(item)}>
            {row}
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator
      style={styles.scrollWrap}
      contentContainerStyle={styles.scrollContent}
    >
      {tableBody}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollWrap: {
    alignSelf: 'stretch',
    maxWidth: '100%',
    ...(Platform.OS === 'web'
      ? ({
          overflowX: 'auto',
          overflowY: 'hidden',
        } as const)
      : null),
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xs,
  },
  table: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PLATFORM_COLORS.border,
    backgroundColor: PLATFORM_COLORS.panel,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#EAF2F8',
    borderBottomWidth: 1,
    borderBottomColor: PLATFORM_COLORS.border,
    minHeight: 40,
    alignItems: 'center',
  },
  headerCell: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  headerText: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  dataRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: PLATFORM_COLORS.border,
    minHeight: 44,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  dataRowAlt: {
    backgroundColor: '#F8FBFD',
  },
  dataRowSelected: {
    backgroundColor: '#E0F2FE',
  },
  dataCell: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  cellText: {
    color: PLATFORM_COLORS.text,
    fontSize: 13,
    lineHeight: 18,
  },
});
