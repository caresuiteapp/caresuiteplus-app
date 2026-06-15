import { Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';

export type TabOption = {
  key: string;
  label: string;
};

type SegmentedTabsProps = {
  tabs: TabOption[];
  activeKey: string;
  onSelect: (key: string) => void;
  style?: ViewStyle;
};

export function SegmentedTabs({ tabs, activeKey, onSelect, style }: SegmentedTabsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.row, style]}
    >
      {tabs.map((tab) => {
        const active = tab.key === activeKey;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onSelect(tab.key)}
            style={[styles.tab, active && styles.tabActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.bgSurface,
  },
  tabActive: {
    borderColor: colors.orange,
    backgroundColor: 'rgba(255,149,0,0.12)',
  },
  label: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  labelActive: {
    color: colors.orange,
  },
});
