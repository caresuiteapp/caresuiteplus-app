import { Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { PremiumCard } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';

type ContextCardProps = {
  icon: string;
  label: string;
  count: number;
  accentColor?: string;
};

/** Shared 2×2 grid for Verknüpfte Bereiche KPI cards — full SectionPanel width. */
export const contextGridStyle = {
  width: '100%',
  alignSelf: 'stretch',
  gap: spacing.sm,
  ...(Platform.OS === 'web'
    ? { display: 'grid' as const, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }
    : { flexDirection: 'row' as const, flexWrap: 'wrap' as const }),
} as ViewStyle;

/** 4-column KPI row for ClientRecordScreen — full width, centered card content. */
export const clientRecordKpiGridStyle = {
  width: '100%',
  alignSelf: 'stretch',
  gap: spacing.sm,
  ...(Platform.OS === 'web'
    ? { display: 'grid' as const, gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }
    : { flexDirection: 'row' as const, flexWrap: 'wrap' as const }),
} as ViewStyle;

export function ContextCard({
  icon,
  label,
  count,
  accentColor = colors.cyan,
}: ContextCardProps) {
  return (
    <View style={styles.cell}>
      <PremiumCard style={styles.card} accentColor={accentColor}>
        <View style={styles.content}>
          <Text style={styles.icon}>{icon}</Text>
          <Text style={[styles.count, { color: accentColor }]}>{count}</Text>
          <Text style={styles.label}>{label}</Text>
        </View>
      </PremiumCard>
    </View>
  );
}

const styles = StyleSheet.create({
  cell: Platform.select({
    web: {
      width: '100%',
      minWidth: 0,
    },
    default: {
      flexGrow: 1,
      flexShrink: 0,
      flexBasis: '48%',
      width: '48%',
      minWidth: '48%',
      maxWidth: '50%',
    },
  })!,
  card: {
    flex: 1,
    width: '100%',
    alignSelf: 'stretch',
    minHeight: 96,
  },
  content: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 72,
  },
  icon: {
    fontSize: 22,
    marginBottom: 4,
    textAlign: 'center',
  },
  count: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  label: {
    ...typography.caption,
    textAlign: 'center',
    marginTop: 4,
  },
});
