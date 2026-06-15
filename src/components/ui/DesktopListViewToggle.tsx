import { StyleSheet, View } from 'react-native';
import { SegmentedTabs } from './SegmentedTabs';
import { spacing } from '@/theme';

export type DesktopListViewMode = 'cards' | 'table';

const VIEW_TABS = [
  { key: 'cards' as const, label: 'Karten' },
  { key: 'table' as const, label: 'Tabelle' },
];

type DesktopListViewToggleProps = {
  value: DesktopListViewMode;
  onChange: (mode: DesktopListViewMode) => void;
};

/** Desktop-Umschalter Karten/Tabelle — für PremiumListHeroFrame-Bereich. */
export function DesktopListViewToggle({ value, onChange }: DesktopListViewToggleProps) {
  return (
    <View style={styles.wrapper}>
      <SegmentedTabs
        tabs={VIEW_TABS}
        activeKey={value}
        onSelect={(key) => onChange(key as DesktopListViewMode)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: spacing.xs,
  },
});
