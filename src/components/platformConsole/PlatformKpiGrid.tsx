import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PLATFORM_COLORS } from './PlatformColors';
import { spacing } from '@/theme';

type KpiItem = {
  label: string;
  value: number | string;
  tone?: 'default' | 'warning' | 'danger' | 'success';
};

type PlatformKpiGridProps = {
  items: KpiItem[];
  columns?: number;
};

export function PlatformKpiGrid({ items, columns = 3 }: PlatformKpiGridProps) {
  const styles = useMemo(
    () =>
      StyleSheet.create({
        grid: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.sm,
        },
        card: {
          flexBasis: `${Math.floor(100 / columns) - 2}%` as unknown as number,
          minWidth: 160,
          flexGrow: 1,
          backgroundColor: PLATFORM_COLORS.panel,
          borderWidth: 1,
          borderColor: PLATFORM_COLORS.border,
          borderRadius: 10,
          padding: spacing.md,
        },
        label: { color: PLATFORM_COLORS.muted, fontSize: 12 },
        value: { color: PLATFORM_COLORS.text, fontSize: 28, fontWeight: '700', marginTop: 6 },
      }),
    [columns],
  );

  function valueColor(tone: KpiItem['tone']) {
    switch (tone) {
      case 'warning':
        return PLATFORM_COLORS.warning;
      case 'danger':
        return PLATFORM_COLORS.danger;
      case 'success':
        return '#22C55E';
      default:
        return PLATFORM_COLORS.text;
    }
  }

  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <View key={item.label} style={styles.card}>
          <Text style={styles.label}>{item.label}</Text>
          <Text style={[styles.value, { color: valueColor(item.tone) }]}>{item.value}</Text>
        </View>
      ))}
    </View>
  );
}
