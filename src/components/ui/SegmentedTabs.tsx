import { Pressable, ScrollView, StyleSheet, Text, type ViewStyle } from 'react-native';
import { useAuroraGlassChipStyles } from '@/design/tokens/auroraGlass';
import { spacing } from '@/theme';

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
  const styles = useAuroraGlassChipStyles();

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
            <Text style={[styles.label, active && styles.labelSelected]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
