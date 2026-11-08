import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { EmployeePortalAssignmentCard } from '@/components/portal/EmployeePortalAssignmentCard';
import { CachedDataBanner } from '@/components/ui/CachedDataBanner';
import { InfoBanner } from '@/components/ui/InfoBanner';
import { ListFilterSelect } from '@/components/ui/ListFilterSelect';
import { withCareSuiteTypography } from '@/design/withCareSuiteTypography';
import { webScaledFontMetric as font } from '@/design/web/webFontSize';
import { useWebFontScaleValue } from '@/design/web/WebFontScaleProvider';
import { useHydrationSafeWindowDimensions } from '@/hooks/useHydrationSafeWindowDimensions';
import type { usePortalAppointments } from '@/hooks/usePortalAppointments';
import type { CachedPortalAppointmentItem } from '@/lib/offline/types';
import type { PortalAppointmentItem } from '@/lib/portal/appointmentService';
import {
  employeePortalAssignmentSchedule,
  employeePortalAssignmentStatus,
  employeePortalAssignmentTitle,
} from '@/lib/portal/employee/employeePortalAssignmentDisplay';
import { groupPortalPastAppointmentsByMonth, type PortalAppointmentTimeGroup } from '@/lib/portal/groupPortalAppointmentsByTime';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import { EmployeePortalAgendaAction, agendaFocusRing } from './EmployeePortalAgendaAction';
import { EmployeePortalArtwork } from './EmployeePortalArtwork';
import { employeePortalDesign as c, employeePortalLayout } from './employeePortalDesign';

type Props = {
  groups: PortalAppointmentTimeGroup[];
  state: Pick<ReturnType<typeof usePortalAppointments>,
    'isEmpty' | 'error' | 'refresh' | 'refreshing' | 'refreshError' | 'showSuccess' | 'fromCache' | 'cachedAt'>;
  loadingMessage?: string;
  onPreview: (id: string) => void;
  continuationAction: (appointment: PortalAppointmentItem) => (() => void) | undefined;
};

const filters = [
  { key: 'all', label: 'Alle' },
  { key: 'upcoming', label: 'Kommend' },
  { key: 'past', label: 'Vergangen' },
] as const;
type AgendaFilter = (typeof filters)[number]['key'];

const scheduledStatuses = new Set<AssignmentStatus>([
  'geplant', 'bestaetigt', 'unterwegs', 'angekommen', 'gestartet', 'pausiert',
]);

function AgendaArtwork({ wide }: { wide: boolean }) {
  return (
    <View style={wide ? styles.artStage : styles.artStageCompact} pointerEvents="none"
      aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg viewBox="0 0 280 240" width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="employeeAgendaHalo">
            <Stop offset="0" stopColor="#90DCFF" stopOpacity={0.24} />
            <Stop offset="1" stopColor="#90DCFF" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={140} cy={120} r={120} fill="url(#employeeAgendaHalo)" />
        <Circle cx={140} cy={120} r={79} fill="none" stroke="#B4E9FF" strokeOpacity={0.3} />
        <Circle cx={140} cy={120} r={104} fill="none" stroke="#B4E9FF" strokeOpacity={0.22} strokeDasharray="2 5" />
        <Circle cx={211} cy={85} r={4} fill="#C2F8FF" />
        <Circle cx={61} cy={188} r={3} fill="#81CEE8" />
        <Circle cx={233} cy={161} r={2} fill="#C2F8FF" />
      </Svg>
      <EmployeePortalArtwork id="assignments" label="" size={wide ? 168 : 64} />
    </View>
  );
}

export function EmployeePortalAssignmentAgenda({ groups, state, loadingMessage, onPreview, continuationAction }: Props) {
  const { width, fontScale } = useHydrationSafeWindowDimensions();
  const webFontScale = useWebFontScaleValue();
  const textScale = Math.max(1, fontScale, webFontScale);
  const { padding, contentWidth } = employeePortalLayout(width);
  const [measuredWidth, setMeasuredWidth] = useState<number>();
  const readableWidth = (measuredWidth ?? contentWidth) / textScale;
  const splitHero = readableWidth >= 600;
  const compact = readableWidth < 480;
  const twoColumns = readableWidth >= 850;

  const [filter, setFilter] = useState<AgendaFilter>('all');
  const [historyMonth, setHistoryMonth] = useState('all');
  const upcoming = groups.find(group => group.key === 'upcoming')?.items ?? [];
  const past = groups.find(group => group.key === 'past')?.items ?? [];
  const counts = { all: upcoming.length + past.length, upcoming: upcoming.length, past: past.length };
  const visibleGroups = groups.filter(group => filter === 'all' || group.key === filter);
  const months = filter === 'past' ? groupPortalPastAppointmentsByMonth(past) : [];
  const selectedMonth = months.find(month => month.key === historyMonth);
  const next = upcoming.find(appointment => Number.isFinite(Date.parse(appointment.startsAt))
    && scheduledStatuses.has(employeePortalAssignmentStatus(appointment)));
  const nextSchedule = next && filter !== 'past' ? employeePortalAssignmentSchedule(next) : null;
  const loadError = !loadingMessage && counts.all === 0 ? state.error : null;
  const { refresh, refreshing } = state;

  return (
    <View style={[styles.outer, { paddingHorizontal: padding }]}>
      <View style={styles.board} onLayout={({ nativeEvent }) => setMeasuredWidth(nativeEvent.layout.width)}>
        <View style={[styles.hero, splitHero && styles.heroWide, compact && styles.heroCompact]} testID="employee-assignments-hero">
          <LinearGradient colors={['rgba(120,182,217,0.21)', 'rgba(29,58,86,0.48)', 'rgba(43,123,136,0.29)']}
            locations={[0, 0.51, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill} pointerEvents="none" />
          <View style={[styles.heroContent, splitHero && styles.heroContentWide]}>
            <View style={styles.heroHeading}>
              <View style={styles.heroCopy}>
                <View style={styles.kickerRow}>
                  <View style={styles.kickerLine} />
                  <Text style={styles.kicker}>Einsatzplan</Text>
                </View>
                <Text accessibilityRole="header" aria-level={1} style={[styles.title, compact && styles.titleCompact, readableWidth < 240 && styles.titleNarrow]}>Meine Einsätze</Text>
                {readableWidth >= 190 ? <Text style={styles.subtitle}>Planung, Durchführung und Verlauf</Text> : null}
              </View>
              {!splitHero && readableWidth >= 229 ? <AgendaArtwork wide={false} /> : null}
            </View>

            {next && nextSchedule ? (
              <Pressable accessibilityRole="button" accessibilityLabel={`Vorschau öffnen. ${employeePortalAssignmentTitle(next)}, ${nextSchedule.date}, ${nextSchedule.time}`}
                onPress={() => onPreview(next.id)} testID="employee-assignments-next"
                style={({ pressed, focused, hovered }: { pressed: boolean; focused?: boolean; hovered?: boolean }) => [
                  styles.next, hovered && styles.hovered, focused && styles.focused, pressed && styles.pressed,
                ]}>
                {!compact ? <View style={styles.nextIcon}><Ionicons name="calendar-outline" size={22} color={c.accent} accessible={false} /></View> : null}
                <View style={styles.nextCopy}>
                  <View style={styles.nextKicker}>
                    <Text style={styles.kicker}>{Date.parse(next.startsAt) > Date.now() ? 'Als Nächstes' : 'Aktuell im Plan'}</Text>
                    {compact ? <Ionicons name="chevron-forward" size={15} color={c.accent} accessible={false} /> : null}
                  </View>
                  <Text style={styles.nextTitle}>{employeePortalAssignmentTitle(next)}</Text>
                  <View style={styles.nextMeta}>
                    <Text style={styles.subtitle}>{nextSchedule.date}</Text>
                    <Text style={styles.subtitle}>{nextSchedule.time}</Text>
                  </View>
                  {nextSchedule.endDay ? <Text style={styles.subtitle}>Ende am {nextSchedule.endDay}</Text> : null}
                </View>
                {!compact ? <Ionicons name="chevron-forward" size={17} color={c.accent} accessible={false} /> : null}
              </Pressable>
            ) : null}
          </View>
          {splitHero ? <AgendaArtwork wide /> : null}
        </View>

        <View style={styles.toolbar}>
          <View style={[styles.filters, compact && styles.filtersCompact]} accessibilityRole="tablist" accessibilityLabel="Einsätze filtern">
            {filters.map(({ key, label }) => {
              const filterLabel = compact && key === 'past' ? 'Verlauf' : label;
              return (
                <Pressable key={key} accessibilityRole="tab"
                  accessibilityLabel={`${filterLabel}, ${counts[key]} ${counts[key] === 1 ? 'Einsatz' : 'Einsätze'}`}
                  accessibilityState={{ selected: filter === key }} onPress={() => setFilter(key)}
                  style={({ pressed, focused, hovered }: { pressed: boolean; focused?: boolean; hovered?: boolean }) => [
                    styles.filter, compact && styles.filterCompact, readableWidth < 190 && styles.filterStacked,
                    filter === key && styles.filterSelected, hovered && styles.hovered,
                    focused && styles.focused, pressed && styles.pressed,
                  ]}>
                  <Text style={[styles.filterText, compact && styles.filterTextCompact, filter === key && styles.filterTextSelected]}>{filterLabel}</Text>
                  <View style={[styles.count, filter === key && styles.countSelected]}>
                    <Text style={styles.countText}>{counts[key]}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <EmployeePortalAgendaAction label={refreshing ? 'Wird aktualisiert…' : 'Aktualisieren'}
            icon="refresh-outline" busy={refreshing} onPress={refresh} />
        </View>

        {state.showSuccess ? <InfoBanner variant="success" presentation="inline" onDarkSurface message="Einsätze aktualisiert." /> : null}
        {state.refreshError && !loadError ? (
          <InfoBanner variant="error" presentation="inline" onDarkSurface title="Aktualisieren nicht möglich"
            message={state.refreshError} actionLabel="Erneut versuchen" onAction={refresh} />
        ) : null}
        <CachedDataBanner visible={state.fromCache} cachedAt={state.cachedAt} onDarkSurface />

        {months.length > 0 ? (
          <ListFilterSelect label="Monat der Einsatzhistorie" value={selectedMonth?.key ?? 'all'}
            options={[{ key: 'all', label: 'Alle Monate' }, ...months.map(({ key, label }) => ({ key, label }))]}
            onChange={setHistoryMonth} style={styles.monthFilter} grow={false} onDarkSurface />
        ) : null}

        {loadingMessage ? (
          <View accessibilityRole="progressbar" accessibilityLabel={loadingMessage} style={styles.notice}>
            <ActivityIndicator color={c.accent} />
            <Text style={styles.subtitle}>{loadingMessage}</Text>
          </View>
        ) : loadError ? (
          <InfoBanner variant="error" presentation="inline" onDarkSurface title="Einsätze konnten nicht geladen werden"
            message={loadError} actionLabel="Erneut versuchen" onAction={refresh} />
        ) : visibleGroups.length === 0 ? (
          <View style={styles.notice}>
            <Ionicons name="calendar-outline" color={c.accent} size={25} accessible={false} />
            <Text accessibilityRole="header" aria-level={2} style={styles.sectionTitle}>
              {state.isEmpty ? 'Keine Einsätze geplant' : filter === 'past' ? 'Keine vergangenen Einsätze' : 'Keine kommenden Einsätze'}
            </Text>
            <Text style={styles.subtitle}>In diesem Zeitraum sind keine Einsätze eingetragen.</Text>
            {filter !== 'all' ? (
              <EmployeePortalAgendaAction label="Alle Einsätze anzeigen" icon="list-outline" onPress={() => setFilter('all')} />
            ) : null}
          </View>
        ) : visibleGroups.map(group => {
          const isPast = group.key === 'past';
          const entries = isPast && selectedMonth ? selectedMonth.items : group.items;
          return (
            <View key={group.key} style={styles.section}>
              <View style={styles.sectionHeading}>
                {readableWidth >= 210 ? (
                  <View style={[styles.sectionIcon, isPast && styles.sectionIconPast]}>
                    <Ionicons name={isPast ? 'time-outline' : 'calendar-outline'} size={17} color={c.accent} accessible={false} />
                  </View>
                ) : null}
                <Text accessibilityRole="header" aria-level={2} style={styles.sectionTitle}>
                  {isPast && selectedMonth ? selectedMonth.label : group.label}
                </Text>
                <View style={styles.count}><Text style={styles.countText}>{entries.length}</Text></View>
              </View>
              <View style={styles.grid}>
                {entries.map(appointment => (
                  <View key={appointment.id} style={[styles.cell, twoColumns && styles.half]}>
                    <EmployeePortalAssignmentCard appointment={appointment}
                      compact={compact} past={isPast} featured={appointment.id === next?.id}
                      cacheStale={state.fromCache || (appointment as CachedPortalAppointmentItem).cacheStale}
                      onPreview={() => onPreview(appointment.id)} onContinue={continuationAction(appointment)} />
                  </View>
                ))}
              </View>
            </View>
          );
        })}
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
  next: {
    flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1,
    borderColor: 'rgba(188,238,255,0.30)', backgroundColor: c.control, padding: 10, minHeight: 70, maxWidth: 550,
  },
  nextIcon: { width: 42, height: 42, borderRadius: 11, backgroundColor: c.selected, alignItems: 'center', justifyContent: 'center' },
  nextCopy: { flex: 1, minWidth: 0, gap: 2 },
  nextKicker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  nextMeta: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 10, rowGap: 0 },
  nextTitle: { color: c.text, fontSize: font(16), lineHeight: font(20), fontWeight: '800' },
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
  monthFilter: { width: '100%', maxWidth: 360, minWidth: 0 },
  section: { gap: 9, minWidth: 0 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  sectionIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: c.selected },
  sectionIconPast: { backgroundColor: c.raised },
  sectionTitle: { color: c.text, flexShrink: 1, minWidth: 0, fontSize: font(18), lineHeight: font(24), fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6, rowGap: 12 },
  cell: { width: '100%', minWidth: 0, paddingHorizontal: 6 },
  half: { width: '50%' },
  notice: { gap: 10, alignItems: 'flex-start', padding: 16, borderRadius: 17, borderWidth: 1, borderColor: c.line, backgroundColor: c.panel },
  hovered: { backgroundColor: c.selected },
  focused: { borderColor: c.accent, ...agendaFocusRing },
  pressed: { opacity: 0.8 },
}));
