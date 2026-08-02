import { Platform, Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { systemLiquidGlass } from '@/design/tokens/systemLiquidGlass';
import { portalPremium, usePortalPremiumTheme } from '@/design/tokens/portalPremium';
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
  const portal = usePortalPremiumTheme();
  const renderTab = (tab: TabOption) => {
    const active = tab.key === activeKey;
    return (
      <Pressable
        key={tab.key}
        onPress={() => onSelect(tab.key)}
        style={({ pressed }) => [
          localStyles.tab,
          portal.active && portalStyles.tab,
          active && localStyles.tabActive,
          active && portal.active && portalStyles.tabActive,
          pressed && localStyles.tabPressed,
        ]}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        {...(Platform.OS === 'web'
          ? ({ dataSet: { csHealthosComponent: 'tab' } } as object)
          : {})}
      >
        <Text
          style={[
            localStyles.label,
            portal.active && portalStyles.label,
            active && localStyles.activeLabel,
            active && portal.active && portalStyles.activeLabel,
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
          <View key={`segment-row-${index}`} style={[localStyles.row, localStyles.wrapRow]}>
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
      contentContainerStyle={[localStyles.row, style]}
    >
      {tabs.map(renderTab)}
    </ScrollView>
  );
}

const localStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: careSpacing.sm,
    paddingVertical: careSpacing.xs,
  },
  tab: {
    minHeight: 40,
    paddingHorizontal: careSpacing.md,
    paddingVertical: careSpacing.sm,
    borderRadius: careRadius.capsule,
    borderWidth: 1,
    borderColor: systemLiquidGlass.border,
    backgroundColor: systemLiquidGlass.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    borderColor: systemLiquidGlass.borderActive,
    backgroundColor: systemLiquidGlass.chipActive,
  },
  tabPressed: { opacity: 0.82 },
  label: {
    ...careTypography.caption,
    color: systemLiquidGlass.text.secondary,
    fontWeight: '600',
  },
  activeLabel: {
    color: systemLiquidGlass.text.primary,
    fontWeight: '800',
  },
  wrapContainer: { gap: spacing.xs },
  wrapRow: { flexWrap: 'wrap' },
});

const portalStyles = StyleSheet.create({
  tab: {
    borderColor: portalPremium.borderSoft,
    backgroundColor: portalPremium.surfaceRaised,
  },
  tabActive: {
    borderColor: portalPremium.borderStrong,
    backgroundColor: portalPremium.surfaceMuted,
  },
  label: { color: portalPremium.text.secondary },
  activeLabel: { color: portalPremium.accent.blueDark },
});
