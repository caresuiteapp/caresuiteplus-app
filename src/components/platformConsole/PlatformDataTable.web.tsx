import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle, type TextStyle } from 'react-native';
import { PLATFORM_COLORS as C } from './PlatformColors';
import { PlatformEmptyState } from './PlatformEmptyState';
import { webScaledFontMetric as font } from '@/design/web/webFontSize';

export type PlatformDataTableColumn<T> = {
  key: string; label: string; flex?: number; width?: number; minWidth?: number;
  align?: 'left' | 'center' | 'right'; render: (item: T) => React.ReactNode;
};
type Props<T> = {
  columns: PlatformDataTableColumn<T>[]; data: T[];
  keyExtractor: (item: T, index: number) => string;
  selectedId?: string | null; onRowPress?: (item: T) => void;
  emptyTitle?: string; emptyMessage?: string; minTableWidth?: number;
};

/** One column definition controls every row. Narrow workspaces become labelled records. */
export function PlatformDataTable<T>({ columns, data, keyExtractor, selectedId, onRowPress,
  emptyTitle = 'Keine Einträge', emptyMessage, minTableWidth }: Props<T>) {
  const [width, setWidth] = useState(0);
  const minimum = Math.max(minTableWidth ?? 0, columns.reduce((sum, col) => sum + (col.width ?? col.minWidth ?? 140), 0));
  const compact = width > 0 && width < minimum;
  const tracks = columns.map(col => col.width != null ? `${col.width}px`
    : `minmax(${col.minWidth ?? 120}px, ${col.flex ?? 1}fr)`).join(' ');
  const grid = { display: 'grid', gridTemplateColumns: tracks } as unknown as ViewStyle;
  const renderCell = (col: PlatformDataTableColumn<T>, item: T) => {
    const value = col.render(item);
    return typeof value === 'string' || typeof value === 'number'
      ? <Text selectable style={styles.value}>{value === '' ? '—' : value}</Text> : value;
  };
  return <View style={styles.root} onLayout={event => setWidth(event.nativeEvent.layout.width)} testID="platform-table">
    {!data.length ? <PlatformEmptyState title={emptyTitle} message={emptyMessage} /> : compact ?
      <View style={styles.cards}>{data.map((item, index) => {
        const id = keyExtractor(item, index);
        return <View key={id} style={[styles.card, selectedId === id && styles.selected]}>
          <View style={[styles.cardFields, { gridTemplateColumns: width < 520 ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))' } as unknown as ViewStyle]}>
            {columns.map((col, columnIndex) => <View key={col.key} style={[styles.field, columnIndex === 0 && styles.recordTitle]}>
              {col.label ? <Text style={styles.fieldLabel}>{col.label}</Text> : null}
              {renderCell(col, item)}
            </View>)}
          </View>
          {onRowPress ? <Pressable accessibilityRole="button" accessibilityLabel="Datensatz öffnen" onPress={() => onRowPress(item)} style={styles.open}><Text style={styles.openText}>Details öffnen →</Text></Pressable> : null}
        </View>;
      })}</View> :
      <View accessibilityRole="table" style={styles.table}>
        <View accessibilityRole="row" style={[styles.header, grid]}>{columns.map(col =>
          <View accessibilityRole="columnheader" key={col.key} style={styles.cell}><Text style={[styles.columnLabel, { textAlign: col.align ?? 'left' }]}>{col.label}</Text></View>
        )}</View>
        {data.map((item, index) => {
          const id = keyExtractor(item, index);
          return <View accessibilityRole="row" key={id} style={[styles.row, grid, index % 2 === 1 && styles.alternate, selectedId === id && styles.selected]}>
            {columns.map((col, columnIndex) => <View accessibilityRole="cell" key={col.key} style={[styles.cell, { alignItems: col.align === 'right' ? 'flex-end' : col.align === 'center' ? 'center' : 'flex-start' }]}>
              {onRowPress && columnIndex === 0 ? <Pressable accessibilityRole="button" onPress={() => onRowPress(item)} style={styles.rowOpen}>{renderCell(col, item)}</Pressable> : renderCell(col, item)}
            </View>)}
          </View>;
        })}
      </View>}
  </View>;
}
const styles = StyleSheet.create({
  root: { width: '100%', minWidth: 0, flexShrink: 0 },
  table: { borderWidth: 1, borderColor: C.border, borderRadius: 14, overflow: 'hidden' },
  header: { backgroundColor: '#EAF2F8', alignItems: 'stretch', borderBottomWidth: 1, borderColor: C.border },
  row: { backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderColor: C.border, alignItems: 'stretch' },
  alternate: { backgroundColor: '#F8FBFE' }, selected: { backgroundColor: '#E7F2FF', borderColor: '#1477D6' },
  cell: { minWidth: 0, paddingHorizontal: 14, paddingVertical: 14, justifyContent: 'center' },
  columnLabel: { color: '#38546F', fontSize: font(13), lineHeight: font(19), fontWeight: '700', width: '100%' },
  value: { color: C.text, fontSize: font(15), lineHeight: font(23), maxWidth: '100%', overflowWrap: 'anywhere' } as unknown as TextStyle,
  cards: { gap: 14 }, card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 18, gap: 12 },
  cardFields: { display: 'grid', gap: 18 } as unknown as ViewStyle,
  field: { minWidth: 0, gap: 6 }, recordTitle: { gridColumn: '1 / -1' } as unknown as ViewStyle,
  fieldLabel: { color: C.muted, fontSize: font(13), lineHeight: font(19), fontWeight: '600' },
  open: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 12, borderRadius: 9, backgroundColor: '#EEF6FF' },
  openText: { color: '#075EB8', fontSize: font(15), fontWeight: '700' }, rowOpen: { minHeight: 32, justifyContent: 'center', width: '100%' },
});
