import { Children, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { withCareSuiteTypography } from '@/design/withCareSuiteTypography';
import { webScaledFontMetric as font } from '@/design/web/webFontSize';
import { useWebFontScaleValue } from '@/design/web/WebFontScaleProvider';
import { useHydrationSafeWindowDimensions } from '@/hooks/useHydrationSafeWindowDimensions';
import { EmployeePortalAgendaAction, agendaFocusRing } from './EmployeePortalAgendaAction';
import { EmployeePortalArtwork } from './EmployeePortalArtwork';
import { employeePortalDesign as c, employeePortalLayout } from './employeePortalDesign';

type AgendaIcon = keyof typeof Ionicons.glyphMap;

export function useEmployeePortalAgendaLayout() {
  const { width, height, fontScale } = useHydrationSafeWindowDimensions();
  const webFontScale = useWebFontScaleValue();
  const { padding, contentWidth } = employeePortalLayout(width);
  const [measuredWidth, setMeasuredWidth] = useState<number>();
  const readableWidth = (measuredWidth ?? contentWidth) / Math.max(1, fontScale, webFontScale);
  return {
    padding, readableWidth, compact: readableWidth < 480, twoColumns: readableWidth >= 850,
    shortLandscape: width > height && height < 520,
    onLayout: ({ nativeEvent }: LayoutChangeEvent) => setMeasuredWidth(nativeEvent.layout.width),
  };
}

type AgendaLayout = ReturnType<typeof useEmployeePortalAgendaLayout>;

export function EmployeePortalAgendaBoard({ layout, children }: { layout: AgendaLayout; children: ReactNode }) {
  return (
    <View style={[styles.outer, { paddingHorizontal: layout.padding }]}>
      <View style={styles.board} onLayout={layout.onLayout}>{children}</View>
    </View>
  );
}

function AgendaArtwork({ wide, artwork }: { wide: boolean; artwork: string }) {
  const haloId = `employeeAgendaHalo-${artwork}`;
  return (
    <View style={wide ? styles.artStage : styles.artStageCompact} pointerEvents="none"
      aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg viewBox="0 0 280 240" width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={haloId}>
            <Stop offset="0" stopColor="#90DCFF" stopOpacity={0.24} />
            <Stop offset="1" stopColor="#90DCFF" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={140} cy={120} r={120} fill={`url(#${haloId})`} />
        <Circle cx={140} cy={120} r={79} fill="none" stroke="#B4E9FF" strokeOpacity={0.3} />
        <Circle cx={140} cy={120} r={104} fill="none" stroke="#B4E9FF" strokeOpacity={0.22} strokeDasharray="2 5" />
        <Circle cx={211} cy={85} r={4} fill="#C2F8FF" />
        <Circle cx={61} cy={188} r={3} fill="#81CEE8" />
        <Circle cx={233} cy={161} r={2} fill="#C2F8FF" />
      </Svg>
      <EmployeePortalArtwork id={artwork} label="" size={wide ? 168 : 64} />
    </View>
  );
}

export function EmployeePortalAgendaHero({ layout, artwork, kicker, title, subtitle, testID, condensed = false, children }: {
  layout: AgendaLayout; artwork: string; kicker: string; title: string; subtitle: string; testID?: string;
  condensed?: boolean; children?: ReactNode;
}) {
  const { readableWidth } = layout;
  const compact = layout.compact || condensed;
  const splitHero = readableWidth >= 600 && !condensed;
  return (
    <View style={[styles.hero, splitHero && styles.heroWide, compact && styles.heroCompact]} testID={testID}>
      <LinearGradient colors={['rgba(120,182,217,0.21)', 'rgba(29,58,86,0.48)', 'rgba(43,123,136,0.29)']}
        locations={[0, 0.51, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={[styles.heroContent, splitHero && styles.heroContentWide]}>
        <View style={styles.heroHeading}>
          <View style={styles.heroCopy}>
            <View style={styles.kickerRow}>
              <View style={styles.kickerLine} />
              <Text style={styles.kicker}>{kicker}</Text>
            </View>
            <Text accessibilityRole="header" aria-level={1} style={[styles.title, compact && styles.titleCompact, readableWidth < 240 && styles.titleNarrow]}>{title}</Text>
            {readableWidth >= 190 ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {!splitHero && readableWidth >= 229 ? <AgendaArtwork wide={false} artwork={artwork} /> : null}
        </View>
        {children}
      </View>
      {splitHero ? <AgendaArtwork wide artwork={artwork} /> : null}
    </View>
  );
}

type AgendaFilter<T extends string> = {
  key: T; label: string; compactLabel?: string; count: number | null;
};

export function EmployeePortalAgendaToolbar<T extends string>({ layout, filters, active, onSelect, refresh, refreshing, unit = ['Einsatz', 'Einsätze'] }: {
  layout: AgendaLayout; filters: readonly AgendaFilter<T>[]; active: T; onSelect: (key: T) => void;
  refresh: () => void; refreshing: boolean; unit?: readonly [string, string];
}) {
  const { compact, readableWidth } = layout;
  return (
    <View style={styles.toolbar}>
      <View style={[styles.filters, compact && styles.filtersCompact]} accessibilityRole="tablist" accessibilityLabel="Einsätze filtern">
        {filters.map(({ key, label, compactLabel, count }) => {
          const visibleLabel = compact && compactLabel ? compactLabel : label;
          const selected = active === key;
          return (
            <Pressable key={key} accessibilityRole="tab"
              accessibilityLabel={count == null ? visibleLabel : `${visibleLabel}, ${count} ${unit[count === 1 ? 0 : 1]}`}
              accessibilityState={{ selected }} onPress={() => onSelect(key)}
              style={({ pressed, focused, hovered }: { pressed: boolean; focused?: boolean; hovered?: boolean }) => [
                styles.filter, compact && styles.filterCompact, readableWidth < 190 && styles.filterStacked,
                selected && styles.filterSelected, hovered && styles.hovered,
                focused && styles.focused, pressed && styles.pressed,
              ]}>
              <Text style={[styles.filterText, compact && styles.filterTextCompact, selected && styles.filterTextSelected]}>{visibleLabel}</Text>
              {count == null ? null : <View style={[styles.count, selected && styles.countSelected]}>
                <Text style={styles.countText}>{count}</Text>
              </View>}
            </Pressable>
          );
        })}
      </View>
      <EmployeePortalAgendaAction label={refreshing ? 'Wird aktualisiert…' : 'Aktualisieren'}
        icon="refresh-outline" busy={refreshing} onPress={refresh} />
    </View>
  );
}

export function EmployeePortalAgendaSection({ layout, icon, title, count, muted = false, warning = false, subtitle, children }: {
  layout: AgendaLayout; icon: AgendaIcon; title: string; count: number; muted?: boolean; warning?: boolean;
  subtitle?: string; children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        {layout.readableWidth >= 210 ? (
          <View style={[styles.sectionIcon, muted && styles.sectionIconPast, warning && styles.sectionIconWarning]}>
            <Ionicons name={icon} size={17} color={warning ? c.warning : c.accent} accessible={false} />
          </View>
        ) : null}
        <Text accessibilityRole="header" aria-level={2} style={styles.sectionTitle}>{title}</Text>
        <View style={styles.count}><Text style={styles.countText}>{count}</Text></View>
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <View style={styles.grid}>
        {Children.map(children, child => <View style={[styles.cell, layout.twoColumns && styles.half]}>{child}</View>)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create(withCareSuiteTypography({
  outer: { width: '100%', minWidth: 0, alignItems: 'center', paddingTop: 18 },
  board: { width: '100%', maxWidth: 1440, minWidth: 0, gap: 18 },
  hero: { borderRadius: 24, borderWidth: 1, borderColor: c.line, padding: 23, overflow: 'hidden' },
  heroWide: { minHeight: 170, justifyContent: 'center' },
  heroCompact: { borderRadius: 19, padding: 14 },
  heroContent: { gap: 16, minWidth: 0 },
  heroContentWide: { width: '69%' },
  heroHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroCopy: { flex: 1, minWidth: 0, gap: 5 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kickerLine: { width: 17, height: 2, borderRadius: 1, backgroundColor: c.accent },
  kicker: { color: c.accent, fontSize: font(10), lineHeight: font(15), letterSpacing: 1.1, fontWeight: '800', textTransform: 'uppercase' },
  title: { color: c.text, fontSize: font(40), lineHeight: font(47), fontWeight: '800', letterSpacing: -0.7 },
  titleCompact: { fontSize: font(27), lineHeight: font(33) },
  titleNarrow: { fontSize: font(24), lineHeight: font(30) },
  subtitle: { color: c.muted, fontSize: font(13), lineHeight: font(19), flexShrink: 1 },
  artStage: { position: 'absolute', top: 0, bottom: 0, right: '3%', width: '27%', alignItems: 'center', justifyContent: 'center' },
  artStageCompact: { width: 70, height: 76, alignItems: 'center', justifyContent: 'center' },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  filters: {
    flexDirection: 'row', flexWrap: 'wrap', padding: 4, gap: 4, minWidth: 0, maxWidth: '100%',
    backgroundColor: c.control, borderWidth: 1, borderColor: c.line, borderRadius: 15,
  },
  filtersCompact: { width: '100%' },
  filter: {
    minHeight: 44, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7, paddingHorizontal: 11,
    paddingVertical: 5, borderWidth: 1, borderColor: 'transparent', borderRadius: 10,
  },
  filterCompact: { flex: 1, minWidth: 0, flexDirection: 'column', gap: 2, paddingHorizontal: 2 },
  filterStacked: { flexBasis: '100%', flexDirection: 'row', gap: 8 },
  filterSelected: { borderColor: 'rgba(175,232,252,0.44)', backgroundColor: c.selected },
  filterText: { flexShrink: 1, textAlign: 'center', color: c.muted, fontSize: font(13), lineHeight: font(18), fontWeight: '700' },
  filterTextCompact: { fontSize: font(12), lineHeight: font(17) },
  filterTextSelected: { color: c.text },
  count: {
    minWidth: 20, minHeight: 20, paddingHorizontal: 5, paddingVertical: 2,
    alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: c.raised,
  },
  countSelected: { backgroundColor: 'rgba(188,238,255,0.22)' },
  countText: { color: c.text, fontSize: font(11), lineHeight: font(15), fontWeight: '700', fontVariant: ['tabular-nums'] },
  section: { gap: 9, minWidth: 0 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  sectionIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: c.selected },
  sectionIconPast: { backgroundColor: c.raised },
  sectionIconWarning: { backgroundColor: 'rgba(255,200,133,0.14)' },
  sectionTitle: { color: c.text, flexShrink: 1, minWidth: 0, fontSize: font(18), lineHeight: font(24), fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6, rowGap: 12 },
  cell: { width: '100%', minWidth: 0, paddingHorizontal: 6 },
  half: { width: '50%' },
  hovered: { backgroundColor: c.selected },
  focused: { borderColor: c.accent, ...agendaFocusRing },
  pressed: { opacity: 0.8 },
}));
