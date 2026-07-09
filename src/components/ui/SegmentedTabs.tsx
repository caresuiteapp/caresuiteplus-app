import { Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AURORA_SURFACE_TEXT, APP_SURFACE_TEXT } from '@/design/tokens/accentContrast';
import { useAuroraGlassChipStyles } from '@/design/tokens/auroraGlass';
import { useListHeroSurface } from '@/design/tokens/listHeroSurfaceContext';
import { careSuiteAuroraTheme } from '@/theme/careSuiteAurora';
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
  /** scroll = eine Zeile mit horizontalem Scroll; wrap = mehrzeilig (z. B. Akten-Tabs). */
  layout?: 'scroll' | 'wrap';
  /** Bei layout=wrap: Tabs gleichmäßig auf N Zeilen verteilen. */
  rows?: number;
};

function chunkTabs(tabs: TabOption[], rows: number): TabOption[][] {
  const rowCount = Math.max(1, rows);
  const chunkSize = Math.ceil(tabs.length / rowCount);
  const chunks: TabOption[][] = [];
  for (let i = 0; i < tabs.length; i += chunkSize) {
    chunks.push(tabs.slice(i, i + chunkSize));
  }
  return chunks;
}

export function SegmentedTabs({
  tabs,
  activeKey,
  onSelect,
  style,
  layout = 'scroll',
  rows,
}: SegmentedTabsProps) {
  const styles = useAuroraGlassChipStyles();
  const heroSurface = useListHeroSurface();
  const inactiveLabelColor = heroSurface === 'gradient' ? AURORA_SURFACE_TEXT : APP_SURFACE_TEXT;

  const renderTab = (tab: TabOption) => {
    const active = tab.key === activeKey;
    return (
      <Pressable
        key={tab.key}
        onPress={() => onSelect(tab.key)}
        style={[styles.tab, active && styles.tabActive, active && localStyles.tabOverflow]}
      >
        {active ? (
          <LinearGradient
            colors={[...careSuiteAuroraTheme.gradients.buttonPrimary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <Text
          style={[
            styles.label,
            !active && { color: inactiveLabelColor },
            active && localStyles.activeLabel,
          ]}
        >
          {tab.label}
        </Text>
      </Pressable>
    );
  };

  if (layout === 'wrap') {
    const rowChunks = rows ? chunkTabs(tabs, rows) : [tabs];
    return (
      <View style={[localStyles.wrapContainer, style]}>
        {rowChunks.map((chunk, index) => (
          <View key={`segment-row-${index}`} style={[styles.row, localStyles.wrapRow]}>
            {chunk.map(renderTab)}
          </View>
        ))}
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.row, style]}
    >
      {tabs.map(renderTab)}
    </ScrollView>
  );
}

const localStyles = StyleSheet.create({
  tabOverflow: { overflow: 'hidden' },
  activeLabel: { color: APP_SURFACE_TEXT, fontWeight: '700' },
  wrapContainer: { gap: spacing.xs },
  wrapRow: { flexWrap: 'wrap' },
});
