import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, designTokens, spacing, typography } from '@/theme';

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
  if (data.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <View style={styles.table}>
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

const styles = StyleSheet.create({
  table: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: designTokens.glass.border,
    backgroundColor: designTokens.glass.background,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderBottomWidth: 1,
    borderBottomColor: designTokens.glass.border,
  },
  headerCell: {
    paddingHorizontal: spacing.xs,
  },
  headerText: {
    ...typography.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontSize: 11,
  },
  headerTextActive: {
    color: colors.orange,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  dataRowAlt: {
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  dataRowSelected: {
    backgroundColor: 'rgba(255,149,0,0.10)',
    borderLeftWidth: 3,
    borderLeftColor: colors.orange,
  },
  dataCell: {
    paddingHorizontal: spacing.xs,
    justifyContent: 'center',
  },
  alignCenter: {
    alignItems: 'center',
  },
  alignRight: {
    alignItems: 'flex-end',
  },
  emptyWrap: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
