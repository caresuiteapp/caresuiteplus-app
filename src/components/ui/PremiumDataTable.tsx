import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useThemeMode } from '@/design/ThemeModeProvider';
import { careLightColors } from '@/design/tokens/lightTheme';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { designTokens, spacing, typography } from '@/theme';

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
  const { mode } = useThemeMode();
  const { colors } = useLegacyTheme();
  const isLight = mode === 'light';

  const themeStyles = useMemo(
    () =>
      isLight
        ? {
            table: {
              borderColor: careLightColors.border,
              backgroundColor: careLightColors.surface,
            },
            headerRow: {
              backgroundColor: careLightColors.page,
              borderBottomColor: careLightColors.border,
            },
            headerText: {
              color: careLightColors.muted,
            },
            headerTextActive: {
              color: careLightColors.orange,
            },
            dataRow: {
              borderBottomColor: careLightColors.border,
            },
            dataRowAlt: {
              backgroundColor: careLightColors.page,
            },
            dataRowHover: {
              backgroundColor: 'rgba(7,18,42,0.04)',
            },
            dataRowSelected: {
              backgroundColor: 'rgba(255,122,26,0.10)',
              borderLeftColor: careLightColors.orange,
            },
            emptyText: {
              color: careLightColors.muted,
            },
          }
        : {
            table: {
              borderColor: designTokens.glass.border,
              backgroundColor: designTokens.glass.background,
            },
            headerRow: {
              backgroundColor: designTokens.table.headerBackground,
              borderBottomColor: designTokens.glass.border,
            },
            headerText: {
              color: colors.textMuted,
            },
            headerTextActive: {
              color: colors.orange,
            },
            dataRow: {
              borderBottomColor: 'rgba(255,255,255,0.06)',
            },
            dataRowAlt: {
              backgroundColor: designTokens.table.rowAltBackground,
            },
            dataRowHover: {
              backgroundColor: 'rgba(255,255,255,0.06)',
            },
            dataRowSelected: {
              backgroundColor: designTokens.table.selectedBackground,
              borderLeftColor: colors.orange,
            },
            emptyText: {
              color: colors.textMuted,
            },
          },
    [colors.orange, colors.textMuted, isLight],
  );

  if (data.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={[styles.emptyText, themeStyles.emptyText]}>{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.table, themeStyles.table]}>
      <View style={[styles.headerRow, themeStyles.headerRow]}>
        {columns.map((col) => {
          const indicator = sortIndicator(col.key, sortColumnKey, sortDirection);
          const headerContent = (
            <Text
              style={[
                styles.headerText,
                themeStyles.headerText,
                col.sortable && sortColumnKey === col.key ? themeStyles.headerTextActive : null,
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
        const rowStyle = [
          styles.dataRow,
          themeStyles.dataRow,
          index % 2 === 1 ? themeStyles.dataRowAlt : null,
          selected ? [styles.dataRowSelected, themeStyles.dataRowSelected] : null,
        ];

        const rowContent = (pressed = false) => (
          <View style={[...rowStyle, pressed && !selected ? themeStyles.dataRowHover : null]}>
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
          return <View key={id}>{rowContent()}</View>;
        }

        return (
          <Pressable key={id} onPress={() => onRowPress(item)}>
            {({ pressed }) => rowContent(pressed)}
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
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
  },
  headerCell: {
    paddingHorizontal: spacing.xs,
  },
  headerText: {
    ...typography.label,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontSize: 11,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: designTokens.table.rowMinHeight,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dataRowSelected: {
    borderLeftWidth: 3,
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
  },
});
