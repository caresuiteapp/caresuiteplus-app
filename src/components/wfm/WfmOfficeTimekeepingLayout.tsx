import { type ReactNode } from 'react';
import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { FilterChip, FilterChipGroup } from '@/components/ui';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { typography } from '@/theme';

export type WfmCompactKpi = {
  key: string;
  label: string;
  value: string;
  accent?: string;
};

type CompactKpiStripProps = {
  items: WfmCompactKpi[];
  maxVisible?: number;
};

export function WfmOfficeCompactKpiStrip({ items, maxVisible = 6 }: CompactKpiStripProps) {
  const text = useAuroraAdaptiveText();
  const visible = items.slice(0, maxVisible);

  return (
    <View style={styles.kpiStrip} testID="wfm-office-kpi-strip">
      {visible.map((item) => (
        <View key={item.key} style={[styles.kpiCell, { borderColor: text.border }]}>
          <Text style={[styles.kpiValue, { color: item.accent ?? text.primary }]} numberOfLines={1}>
            {item.value}
          </Text>
          <Text style={[styles.kpiLabel, { color: text.secondary }]} numberOfLines={1}>
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

type FilterBarProps = {
  periodSlot: ReactNode;
  secondarySlot?: ReactNode;
  statusSlot?: ReactNode;
};

export function WfmOfficeFilterBar({ periodSlot, secondarySlot, statusSlot }: FilterBarProps) {
  return (
    <View style={styles.filterBar} testID="wfm-office-filter-bar">
      <View style={styles.filterPrimary}>{periodSlot}</View>
      {secondarySlot ? <View style={styles.filterSecondary}>{secondarySlot}</View> : null}
      {statusSlot ? <View style={styles.filterStatus}>{statusSlot}</View> : null}
    </View>
  );
}

type PeriodChipGroupProps<T extends string> = {
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
};

export function WfmOfficePeriodChips<T extends string>({ options, value, onChange }: PeriodChipGroupProps<T>) {
  return (
    <FilterChipGroup
      options={options.map((o) => ({ key: o.key, label: o.label }))}
      selectedKey={value}
      onSelect={onChange}
      wrap
    />
  );
}

export function WfmOfficeStatusChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return <FilterChip label={label} selected={selected} onPress={onPress} />;
}

type SplitWorkAreaProps = {
  main: ReactNode;
  detail: ReactNode | null;
  detailOpen: boolean;
};

export function WfmOfficeSplitWorkArea({ main, detail, detailOpen }: SplitWorkAreaProps) {
  const { width } = useWindowDimensions();
  const desktop = width >= 960;

  if (!detailOpen || !detail) {
    return <View style={styles.workMain}>{main}</View>;
  }

  if (desktop) {
    return (
      <View style={styles.splitRow}>
        <View style={styles.workMain}>{main}</View>
        <View style={styles.workDetail}>{detail}</View>
      </View>
    );
  }

  return (
    <View style={styles.workMain}>
      {main}
      <View style={styles.mobileDetail}>{detail}</View>
    </View>
  );
}

export function WfmOfficeSectionHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const text = useAuroraAdaptiveText();
  return (
    <View style={styles.sectionHeading}>
      <Text style={[styles.sectionTitle, { color: text.primary }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.sectionSubtitle, { color: text.secondary }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  kpiStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: careSpacing.sm,
    marginBottom: careSpacing.md,
  },
  kpiCell: {
    minWidth: 118,
    flexGrow: 1,
    flexBasis: Platform.OS === 'web' ? ('12%' as unknown as number) : '30%',
    maxWidth: Platform.OS === 'web' ? 190 : undefined,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: careSpacing.md,
    paddingVertical: careSpacing.sm,
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.88)',
    shadowColor: '#173B70',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  kpiValue: {
    ...typography.bodyMedium,
    fontWeight: '700',
    fontSize: 20,
    lineHeight: 24,
  },
  kpiLabel: {
    ...typography.caption,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.2,
  },
  filterBar: {
    gap: careSpacing.sm,
    marginBottom: careSpacing.md,
    padding: careSpacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(20,120,255,0.14)',
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.76)',
  },
  filterPrimary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: careSpacing.xs,
    alignItems: 'center',
  },
  filterSecondary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: careSpacing.xs,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: careSpacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(20,120,255,0.12)',
  },
  filterStatus: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: careSpacing.xs,
    alignItems: 'center',
    paddingTop: careSpacing.xs,
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: careSpacing.md,
    minHeight: 0,
  },
  workMain: {
    flex: 1,
    minWidth: 0,
    gap: careSpacing.sm,
  },
  workDetail: {
    width: 420,
    maxWidth: '42%',
    flexShrink: 0,
    minHeight: 0,
  },
  mobileDetail: {
    marginTop: careSpacing.sm,
  },
  sectionHeading: {
    gap: 4,
    marginBottom: careSpacing.sm,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    ...typography.h3,
    fontWeight: '800',
  },
  sectionSubtitle: {
    ...typography.body,
    fontSize: 13,
  },
});
