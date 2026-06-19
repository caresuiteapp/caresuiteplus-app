import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuroraGlassTableStyles } from '@/design/tokens/auroraGlass';

export type DataTableColumn<T> = {
  key: string;
  label: string;
  flex?: number;
  width?: number;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  render: (item: T) => React.ReactNode;
};

type PremiumDataTableProps<T> = {
  columns: DataTableColumn<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  selectedId?: string | null;
  onRowPress?: (item: T) => void;
  emptyMessage?: string;
  sortColumnKey?: string | null;
  sortDirection?: 'asc' | 'desc';
  onSortColumn?: (columnKey: string) => void;
};

function sortIndicator(
  columnKey: string,
  sortColumnKey: string | null | undefined,
  sortDirection: 'asc' | 'desc' | undefined,
): string | null {
  if (sortColumnKey !== columnKey) return null;
  return sortDirection === 'desc' ? ' ▼' : ' ▲';
}

export function PremiumDataTable<T>({
  columns,
  data,
  keyExtractor,
  selectedId = null,
  onRowPress,
  emptyMessage = 'Keine Einträge',
  sortColumnKey = null,
  sortDirection = 'asc',
  onSortColumn,
}: PremiumDataTableProps<T>) {
  const styles = useAuroraGlassTableStyles();

  if (data.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <View style={styles.table} testID="table-container">
      <View style={styles.headerRow}>
        {columns.map((col) => {
          const indicator = sortIndicator(col.key, sortColumnKey, sortDirection);
          const headerContent = (
            <Text
              style={[
                styles.headerText,
                col.sortable && sortColumnKey === col.key ? styles.headerTextActive : null,
              ]}
            >
              {col.label}
              {indicator}
            </Text>
          );

          const cellStyle = [
            styles.headerCell,
            col.flex != null ? { flex: col.flex } : null,
            col.width != null ? { width: col.width } : null,
            col.align === 'center' ? styles.alignCenter : null,
            col.align === 'right' ? styles.alignRight : null,
          ];

          if (col.sortable && onSortColumn) {
            return (
              <Pressable
                key={col.key}
                style={cellStyle}
                onPress={() => onSortColumn(col.key)}
                accessibilityRole="button"
                accessibilityLabel={`Sortieren nach ${col.label}`}
              >
                {headerContent}
              </Pressable>
            );
          }

          return (
            <View key={col.key} style={cellStyle}>
              {headerContent}
            </View>
          );
        })}
      </View>

      {data.map((item, index) => {
        const id = keyExtractor(item);
        const selected = selectedId === id;
        const row = (
          <View
            style={[
              styles.dataRow,
              index % 2 === 1 ? styles.dataRowAlt : null,
              selected ? styles.dataRowSelected : null,
            ]}
          >
            {columns.map((col) => (
              <View
                key={col.key}
                style={[
                  styles.dataCell,
                  col.flex != null ? { flex: col.flex } : null,
                  col.width != null ? { width: col.width } : null,
                  col.align === 'center' ? styles.alignCenter : null,
                  col.align === 'right' ? styles.alignRight : null,
                ]}
              >
                {col.render(item)}
              </View>
            ))}
          </View>
        );

        if (!onRowPress) {
          return <View key={id}>{row}</View>;
        }

        return (
          <Pressable key={id} onPress={() => onRowPress(item)}>
            {row}
          </Pressable>
        );
      })}
    </View>
  );
}
