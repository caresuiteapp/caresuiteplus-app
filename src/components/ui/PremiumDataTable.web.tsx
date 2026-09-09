import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import { SurfaceContrastProvider } from '@/design/tokens/surfaceContrast';
import { webScaledFontMetric as font } from '@/design/web/webFontSize';

export type DataTableColumn<T> = {
  key: string; label: string; flex?: number; width?: number; minWidth?: number;
  align?: 'left' | 'center' | 'right'; sortable?: boolean; render: (item: T) => React.ReactNode;
};
type Props<T> = {
  columns: DataTableColumn<T>[]; data: T[]; keyExtractor: (item: T) => string;
  selectedId?: string | null; onRowPress?: (item: T) => void; emptyMessage?: string;
  sortColumnKey?: string | null; sortDirection?: 'asc' | 'desc'; onSortColumn?: (key: string) => void;
  fixedLayout?: boolean; solidSurface?: boolean; darkSurface?: boolean; minTableWidth?: number;
};
const interactive = 'a,button,input,textarea,select,label,[role="button"],[role="checkbox"],[role="switch"],[role="link"],[role="tab"],[contenteditable="true"]';

/** A single track definition aligns headers and records. Width belongs to the workspace, not the monitor. */
export function PremiumDataTable<T>({ columns, data, keyExtractor, selectedId, onRowPress,
  emptyMessage = 'Keine Einträge', sortColumnKey, sortDirection = 'asc', onSortColumn,
  fixedLayout = false, solidSurface = false, darkSurface = false, minTableWidth }: Props<T>) {
  const [width, setWidth] = useState(0);
  const minimumFor = (column: DataTableColumn<T>) => Math.max(64, column.width ?? column.minWidth ?? 144);
  const minimum = Math.max(minTableWidth ?? 0, columns.reduce((sum, col) => sum + minimumFor(col), 0));
  const compact = width === 0 || width < minimum;
  const tracks = columns.map(col => col.width != null && fixedLayout ? `${minimumFor(col)}px`
    : `minmax(${minimumFor(col)}px, ${Math.max(0.1, col.flex ?? 1)}fr)`).join(' ');
  const grid = { display: 'grid', gridTemplateColumns: tracks } as unknown as ViewStyle;
  const tone = darkSurface ? 'dark' : 'light';
  const color = darkSurface ? '#EAF4FF' : '#102B49';
  const muted = darkSurface ? '#B8CDE0' : '#526B82';
  const renderCell = (col: DataTableColumn<T>, item: T) => {
    const value = col.render(item);
    return value == null || typeof value === 'string' || typeof value === 'number'
      ? <Text selectable style={[styles.value, { color }]}>{value == null || value === '' ? '—' : value}</Text> : value;
  };
  const sortButton = (col: DataTableColumn<T>) => <Pressable
    accessibilityRole="button" accessibilityLabel={`Nach ${col.label} sortieren${sortColumnKey === col.key ? `, aktuell ${sortDirection === 'desc' ? 'absteigend' : 'aufsteigend'}` : ''}`}
    onPress={() => onSortColumn?.(col.key)} style={styles.sortButton}>
    <Text style={[styles.label, { color: sortColumnKey === col.key ? (darkSurface ? '#81DCFF' : '#075EB8') : muted, textAlign: col.align ?? 'left' }]}>
      {col.label}{sortColumnKey === col.key ? (sortDirection === 'desc' ? ' ↓' : ' ↑') : ' ↕'}
    </Text>
  </Pressable>;
  const rowClick = (event: React.MouseEvent<HTMLDivElement>, item: T) => {
    if (!onRowPress || event.defaultPrevented) return;
    const target = event.target as Element;
    if (target.closest?.(interactive) || window.getSelection()?.toString()) return;
    onRowPress(item);
  };
  return <SurfaceContrastProvider tone={tone}><View style={styles.root}
    onLayout={event => setWidth(event.nativeEvent.layout.width)}
    dataSet={{ csWorkspaceComponent: 'data-table', csWorkspaceTone: tone, csWorkspaceSolid: String(solidSurface) }}>
    {!data.length ? <View style={[styles.empty, darkSurface && styles.darkCard]}><Text style={[styles.value, { color: muted }]}>{emptyMessage}</Text></View> : compact ? <>
      {onSortColumn && columns.some(col => col.sortable) ? <View style={styles.sortBar}>
        <Text style={[styles.label, { color: muted }]}>Sortieren:</Text>
        {columns.filter(col => col.sortable).map(col => <View key={col.key}>{sortButton(col)}</View>)}
      </View> : null}
      <View style={styles.cards}>{data.map(item => {
        const id = keyExtractor(item);
        return <View key={id} style={[styles.card, darkSurface && styles.darkCard, selectedId === id && (darkSurface ? styles.darkSelected : styles.selected)]}>
          <View style={[styles.fields, { gridTemplateColumns: width >= 560 ? 'repeat(2,minmax(0,1fr))' : 'minmax(0,1fr)' } as unknown as ViewStyle]}>
            {columns.map((col, index) => <View key={col.key} style={[styles.field, index === 0 && styles.firstField]} dataSet={{ csWorkspaceCell: 'true' }}>
              <Text style={[styles.label, { color: muted }]}>{col.label || 'Aktionen'}</Text>
              {renderCell(col, item)}
            </View>)}
          </View>
          {onRowPress ? <Pressable accessibilityRole="button" onPress={() => onRowPress(item)} style={[styles.open, darkSurface && styles.darkOpen]}>
            <Text style={[styles.openText, darkSurface && { color: '#81DCFF' }]}>Details öffnen →</Text>
          </Pressable> : null}
        </View>;
      })}</View>
    </> : <View accessibilityRole="table" style={[styles.table, darkSurface && styles.darkCard]} testID="table-container">
      <View accessibilityRole="row" style={[styles.header, grid, darkSurface && styles.darkHeader]}>
        {columns.map(col => <View accessibilityRole="columnheader" key={col.key} style={styles.cell}
          {...{ 'aria-sort': sortColumnKey === col.key ? (sortDirection === 'desc' ? 'descending' : 'ascending') : undefined }}>
          {col.sortable && onSortColumn ? sortButton(col) : <Text style={[styles.label, { color: muted, textAlign: col.align ?? 'left' }]}>{col.label}</Text>}
        </View>)}
      </View>
      {data.map((item, index) => {
        const id = keyExtractor(item);
        return <div key={id} role="row" tabIndex={onRowPress ? 0 : undefined}
          data-cs-workspace-record="true" data-selected={selectedId === id ? 'true' : undefined}
          style={{ display: 'grid', gridTemplateColumns: tracks, minWidth: 0, alignItems: 'stretch',
            background: selectedId === id ? (darkSurface ? '#16446B' : '#E7F2FF') : index % 2 ? (darkSurface ? '#102D4A' : '#F6FAFE') : (darkSurface ? '#0A2340' : '#FFFFFF'),
            borderTop: `1px solid ${darkSurface ? '#294961' : '#D6E3EF'}`, cursor: onRowPress ? 'pointer' : undefined,
            boxShadow: selectedId === id ? `inset 3px 0 ${darkSurface ? '#69D7FF' : '#1477D6'}` : undefined }}
          onClick={event => rowClick(event, item)} onKeyDown={event => {
            if (event.target === event.currentTarget && onRowPress && (event.key === 'Enter' || event.key === ' ')) {
              event.preventDefault(); onRowPress(item);
            }
          }}>
          {columns.map(col => <View accessibilityRole="cell" key={col.key} dataSet={{ csWorkspaceCell: 'true' }}
            style={[styles.cell, { alignItems: col.align === 'right' ? 'flex-end' : col.align === 'center' ? 'center' : 'stretch' }]}>
            {renderCell(col, item)}
          </View>)}
        </div>;
      })}
    </View>}
  </View></SurfaceContrastProvider>;
}
const styles = StyleSheet.create({
  root: { width: '100%', minWidth: 0, flexShrink: 0 },
  table: { borderWidth: 1, borderColor: '#CCDBEA', borderRadius: 14, overflow: 'hidden' },
  header: { alignItems: 'stretch', backgroundColor: '#EAF2F8' },
  darkHeader: { backgroundColor: '#112F4D' },
  cell: { minWidth: 0, paddingHorizontal: 14, paddingVertical: 12, justifyContent: 'center' },
  label: { fontSize: font(14), lineHeight: font(21), fontWeight: '700', maxWidth: '100%' },
  value: { fontSize: font(16), lineHeight: font(24), maxWidth: '100%', overflowWrap: 'anywhere' } as unknown as TextStyle,
  sortButton: { minHeight: 44, justifyContent: 'center', borderRadius: 6 },
  sortBar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 16, marginBottom: 12 },
  cards: { gap: 14 },
  card: { minWidth: 0, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CCDBEA', borderRadius: 16, padding: 18, gap: 16 },
  darkCard: { backgroundColor: '#0A2340', borderColor: '#345971' },
  selected: { backgroundColor: '#E7F2FF', borderColor: '#1477D6' },
  darkSelected: { backgroundColor: '#16446B', borderColor: '#69D7FF' },
  fields: { display: 'grid', gap: 18 } as unknown as ViewStyle,
  field: { minWidth: 0, gap: 6 }, firstField: { gridColumn: '1 / -1' } as unknown as ViewStyle,
  open: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center', paddingHorizontal: 14, backgroundColor: '#EDF5FF', borderRadius: 9 },
  darkOpen: { backgroundColor: '#173C5C' }, openText: { fontSize: font(15), lineHeight: font(23), color: '#075EB8', fontWeight: '700' },
  empty: { padding: 24, borderRadius: 14, borderWidth: 1, borderColor: '#CCDBEA', backgroundColor: '#FFFFFF' },
});
