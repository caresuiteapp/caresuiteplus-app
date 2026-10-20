import React, { useMemo } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { useAuroraGlassTableStyles } from "@/design/tokens/auroraGlass";

export type DataTableColumn<T> = {
  key: string;
  label: string;
  flex?: number;
  width?: number;
  minWidth?: number;
  align?: "left" | "center" | "right";
  sortable?: boolean;
  render: (item: T) => React.ReactNode;
};

function columnCellStyle<T>(
  col: DataTableColumn<T>,
  fixedLayout?: boolean,
): ViewStyle[] {
  const styles: ViewStyle[] = [];
  if (col.width != null)
    styles.push({
      width: col.width,
      minWidth: col.width,
      maxWidth: fixedLayout ? col.width : undefined,
      flexShrink: 0,
      flexGrow: 0,
    });
  else if (col.flex != null)
    styles.push({
      flex: col.flex,
      flexShrink: fixedLayout ? 0 : col.minWidth != null ? 0 : 1,
      minWidth: col.minWidth ?? 0,
    });
  else if (col.minWidth != null)
    styles.push({ minWidth: col.minWidth, flexShrink: 0 });
  if (col.align === "center") styles.push({ alignItems: "center" });
  if (col.align === "right") styles.push({ alignItems: "flex-end" });
  if (fixedLayout) styles.push({ overflow: "hidden" });
  return styles;
}

function resolveMinTableWidth<T>(columns: DataTableColumn<T>[]): number {
  return columns.reduce(
    (sum, col) =>
      col.width != null
        ? sum + col.width
        : col.minWidth != null
          ? sum + col.minWidth
          : sum + 80,
    0,
  );
}

const headerTextWebStyle =
  Platform.OS === "web"
    ? ({ whiteSpace: "nowrap" } as unknown as TextStyle)
    : undefined;

type PremiumDataTableProps<T> = {
  columns: DataTableColumn<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  selectedId?: string | null;
  onRowPress?: (item: T) => void;
  emptyMessage?: string;
  sortColumnKey?: string | null;
  sortDirection?: "asc" | "desc";
  onSortColumn?: (columnKey: string) => void;
  fixedLayout?: boolean;
  solidSurface?: boolean;
  darkSurface?: boolean;
  minTableWidth?: number;
};

function sortIndicator(
  columnKey: string,
  sortColumnKey: string | null | undefined,
  sortDirection: "asc" | "desc" | undefined,
): string | null {
  if (sortColumnKey !== columnKey) return null;
  return sortDirection === "desc" ? " ▼" : " ▲";
}

export function PremiumDataTable<T>({
  columns,
  data,
  keyExtractor,
  selectedId = null,
  onRowPress,
  emptyMessage = "Keine Einträge",
  sortColumnKey = null,
  sortDirection = "asc",
  onSortColumn,
  fixedLayout = false,
  solidSurface = false,
  darkSurface = false,
  minTableWidth,
}: PremiumDataTableProps<T>) {
  const styles = useAuroraGlassTableStyles({ solidSurface });
  const resolvedMinWidth = useMemo(
    () =>
      minTableWidth ??
      (fixedLayout ? resolveMinTableWidth(columns) : undefined),
    [columns, fixedLayout, minTableWidth],
  );

  if (data.length === 0)
    return (
      <View
        style={[
          styles.emptyWrap,
          solidSurface ? localStyles.emptySolid : null,
          darkSurface && localStyles.emptyDark,
        ]}
      >
        <Text
          style={[styles.emptyText, darkSurface && localStyles.emptyTextDark]}
        >
          {emptyMessage}
        </Text>
      </View>
    );

  const tableBody = (
    <View
      style={[
        styles.table,
        darkSurface && localStyles.tableDark,
        resolvedMinWidth != null
          ? {
              minWidth: resolvedMinWidth,
              width: fixedLayout ? "100%" : undefined,
            }
          : localStyles.fluidTable,
      ]}
      testID="table-container"
      {...(Platform.OS === "web"
        ? ({
            dataSet: {
              csHealthosComponent: "table",
              csHealthosSurface: darkSurface ? "dark" : "adaptive",
            },
          } as object)
        : {})}
    >
      <View
        style={[styles.headerRow, darkSurface && localStyles.headerRowDark]}
      >
        {columns.map((col) => {
          const indicator = sortIndicator(
            col.key,
            sortColumnKey,
            sortDirection,
          );
          const headerContent = (
            <Text
              style={[
                styles.headerText,
                headerTextWebStyle,
                darkSurface && localStyles.headerTextDark,
                col.sortable && sortColumnKey === col.key
                  ? styles.headerTextActive
                  : null,
              ].filter(Boolean)}
              numberOfLines={1}
            >
              {col.label}
              {indicator}
            </Text>
          );
          const cellStyle = [
            styles.headerCell,
            ...columnCellStyle(col, fixedLayout),
          ];
          if (col.sortable && onSortColumn)
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
              fixedLayout && localStyles.fixedRow,
              darkSurface && localStyles.dataRowDark,
              darkSurface && index % 2 === 1 && localStyles.dataRowDarkAlt,
              !darkSurface && index % 2 === 1 && styles.dataRowAlt,
              selected &&
                (darkSurface
                  ? localStyles.dataRowDarkSelected
                  : styles.dataRowSelected),
            ]}
          >
            {columns.map((col) => (
              <View
                key={col.key}
                style={[
                  styles.dataCell,
                  ...columnCellStyle(col, fixedLayout),
                  fixedLayout && localStyles.fixedCell,
                ]}
              >
                {col.render(item)}
              </View>
            ))}
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

  if (
    fixedLayout ||
    columns.some((col) => col.minWidth != null || col.width != null)
  )
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={fixedLayout}
        style={fixedLayout ? localStyles.scrollWrap : undefined}
        contentContainerStyle={localStyles.scrollContent}
        testID={fixedLayout ? "table-scroll-container" : undefined}
      >
        {tableBody}
      </ScrollView>
    );
  return tableBody;
}

const localStyles = StyleSheet.create({
  fluidTable: { width: "100%" },
  scrollWrap: {
    maxWidth: "100%",
    ...(Platform.OS === "web"
      ? ({ overflowX: "auto", overflowY: "hidden" } as const)
      : null),
  },
  scrollContent: { flexGrow: 1 },
  fixedRow: { minHeight: 56, alignItems: "center" },
  fixedCell: { overflow: "hidden", justifyContent: "center" },
  emptySolid: {
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.13)",
  },
  tableDark: {
    backgroundColor: "#071A31",
    borderColor: "rgba(105, 215, 255, 0.46)",
  },
  headerRowDark: { backgroundColor: "#DDEEFF", borderBottomColor: "#8BCBEF" },
  headerTextDark: { color: "#071A31", fontWeight: "900" },
  dataRowDark: {
    backgroundColor: "#0A2340",
    borderBottomColor: "rgba(128, 202, 240, 0.19)",
  },
  dataRowDarkAlt: { backgroundColor: "#0D2C4C" },
  dataRowDarkSelected: {
    backgroundColor: "#16446B",
    borderLeftWidth: 3,
    borderLeftColor: "#69D7FF",
  },
  emptyDark: {
    backgroundColor: "#0A2340",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(105, 215, 255, 0.46)",
  },
  emptyTextDark: { color: "#D5E8F7" },
});
