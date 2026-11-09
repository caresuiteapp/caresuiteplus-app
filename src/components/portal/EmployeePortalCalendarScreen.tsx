import { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import type { CalendarEvent, CalendarViewMode } from '@/types/modules/calendarEvent';
import { CalendarEventGrid } from '@/components/calendar/CalendarEventGrid';
import { InfoBanner } from '@/components/ui/InfoBanner';
import { PlatformModal } from '@/components/layout/platform/platformmodal';
import { usePortalActor } from '@/hooks/usePortalActor';
import { useEmployeePortalCalendarEvents } from '@/hooks/useEmployeePortalCalendarEvents';
import { employeePortalCalendarEventHref, employeePortalCalendarEventOverlaps, employeePortalCalendarPeriod } from '@/lib/portal/employeePortalCalendarNavigation';
import { addDays, addWeeks, formatDayHeader, formatMonthYear, formatWeekRange } from '@/lib/office/calendarDateUtils';
import { addCalendarMonthsClamped, addCalendarYearsClamped } from '@/lib/calendar/calendarWebViewModel';
import { careTypography } from '@/design/tokens/typography';
import { withCareSuiteTypography } from '@/design/withCareSuiteTypography';
import { webScaledFontMetric as font } from '@/design/web/webFontSize';
import { EmployeePortalAgendaAction, agendaFocusRing } from './employee/EmployeePortalAgendaAction';
import { EmployeePortalAgendaHero, useEmployeePortalAgendaLayout } from './employee/EmployeePortalAgendaLayout';
import {
  EmployeePortalCalendarAgenda, employeeCalendarCategories, employeeCalendarCategory,
  formatEmployeeCalendarWhen, type EmployeeCalendarCategory,
} from './employee/EmployeePortalCalendarAgenda';
import { ClientRecordLoading, ClientRecordPanel, ClientRecordViewport, clientRecordTextWrap } from './employee/EmployeePortalClientRecordLayout';
import { employeePortalDesign as c } from './employee/employeePortalDesign';

type EmployeePortalCalendarScreenProps = { onEventPress?: (event: CalendarEvent) => void };
type CalendarFilter = 'all' | EmployeeCalendarCategory;

const VIEWS: readonly { value: CalendarViewMode; label: string }[] = [
  { value: 'agenda', label: 'Agenda' }, { value: 'day', label: 'Tag' }, { value: 'week', label: 'Woche' },
  { value: 'month', label: 'Monat' }, { value: 'year', label: 'Jahr' }, { value: 'list', label: 'Liste' },
];

const FILTERS = [
  { value: 'all', label: 'Alle', color: c.accent },
  { value: 'assignments', ...employeeCalendarCategories.assignments },
  { value: 'appointments', ...employeeCalendarCategories.appointments },
  { value: 'absences', ...employeeCalendarCategories.absences },
] as const;

const WEEK_START = 1;

function calendarPeriodTitle(anchor: Date, mode: CalendarViewMode, start: Date, end: Date) {
  if (mode === 'day') return formatDayHeader(anchor);
  if (mode === 'month' || mode === 'list') return formatMonthYear(anchor);
  if (mode === 'year') return String(anchor.getFullYear());
  const week = formatWeekRange(anchor, WEEK_START);
  return start.getFullYear() === addDays(end, -1).getFullYear() ? week + ' ' + start.getFullYear() : week;
}

function PeriodArrow({ next = false, onPress }: { next?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={next ? 'Nächster Zeitraum' : 'Vorheriger Zeitraum'} onPress={onPress}
      style={({ hovered, focused, pressed }: { hovered?: boolean; focused?: boolean; pressed: boolean }) => [
        styles.control, styles.arrow, hovered && styles.hover, focused && styles.focus, pressed && styles.pressed,
      ]}>
      <Ionicons name={next ? 'chevron-forward' : 'chevron-back'} size={19} color={c.accent} accessible={false} />
    </Pressable>
  );
}

export function EmployeePortalCalendarScreen({ onEventPress }: EmployeePortalCalendarScreenProps) {
  const router = useRouter();
  const layout = useEmployeePortalAgendaLayout();
  const { tenantId, employeeId, actorId, roleKey } = usePortalActor();
  const [viewMode, setViewMode] = useState<CalendarViewMode>('agenda');
  const [anchor, setAnchor] = useState(() => new Date());
  const [filter, setFilter] = useState<CalendarFilter>('all');
  const [selection, setSelection] = useState<{ id: string; scope: string } | null>(null);

  const { start, end } = useMemo(() => employeePortalCalendarPeriod(anchor, viewMode), [anchor, viewMode]);
  const rangeStart = start.toISOString();
  const rangeEnd = end.toISOString();
  const scope = JSON.stringify([tenantId, employeeId, actorId, roleKey, rangeStart, rangeEnd]);
  const { events, loading, error, refresh, refreshError, refreshing } = useEmployeePortalCalendarEvents(rangeStart, rangeEnd);
  const periodEvents = useMemo(() => events.filter(event => employeePortalCalendarEventOverlaps(event, start, end)), [events, start, end]);
  const counts = useMemo(() => {
    const totals: Record<CalendarFilter, number> = { all: periodEvents.length, assignments: 0, appointments: 0, absences: 0 };
    for (const event of periodEvents) totals[employeeCalendarCategory(event)] += 1;
    return totals;
  }, [periodEvents]);
  const visibleEvents = useMemo(() => filter === 'all' ? periodEvents
    : periodEvents.filter(event => employeeCalendarCategory(event) === filter), [periodEvents, filter]);
  const selectedEvent = selection?.scope === scope ? visibleEvents.find(event => event.id === selection.id) : undefined;
  const title = calendarPeriodTitle(anchor, viewMode, start, end);
  const agendaView = viewMode === 'agenda' || viewMode === 'list';
  const initialLoading = loading && periodEvents.length === 0;
  const refreshCalendar = () => void refresh();

  const navigate = (delta: number) => {
    setAnchor(prev => {
      if (viewMode === 'day') return addDays(prev, delta);
      if (viewMode === 'week' || viewMode === 'agenda') return addWeeks(prev, delta);
      if (viewMode === 'month' || viewMode === 'list') return addCalendarMonthsClamped(prev, delta);
      return addCalendarYearsClamped(prev, delta);
    });
  };
  const openDay = useCallback((date: Date) => {
    setAnchor(date);
    setViewMode('day');
  }, []);
  const openMonth = useCallback((monthIndex: number) => {
    setAnchor(new Date(anchor.getFullYear(), monthIndex, 1));
    setViewMode('month');
  }, [anchor]);
  const openEvent = useCallback((event: CalendarEvent) => {
    if (onEventPress) {
      onEventPress(event);
      return;
    }
    const href = employeePortalCalendarEventHref(event, employeeId);
    if (href) router.push(href as never);
    else setSelection({ id: event.id, scope });
  }, [onEventPress, employeeId, router, scope]);

  return (
    <>
      <ClientRecordViewport layout={layout} testID="employee-portal-calendar">
        <EmployeePortalAgendaHero layout={layout} artwork="calendar" kicker="Planung im Team" title="Teamkalender"
          subtitle="Einsätze, Termine und Abwesenheiten" condensed={layout.shortLandscape}>
          <View style={styles.heroActions}>
            <EmployeePortalAgendaAction label="Aktualisieren" icon="refresh-outline" busy={loading || refreshing} onPress={refreshCalendar} />
          </View>
        </EmployeePortalAgendaHero>

        <View style={[styles.controlPanel, layout.compact && styles.controlPanelCompact]}>
          <View style={styles.periodRow}>
            <View style={styles.periodCopy}>
              <Text style={styles.eyebrow}>Zeitraum</Text>
              <Text accessibilityRole="header" aria-level={2} accessibilityLiveRegion="polite"
                style={[styles.periodTitle, layout.compact && styles.periodTitleCompact]}>{title}</Text>
            </View>
            <View style={styles.periodButtons}>
              <PeriodArrow onPress={() => navigate(-1)} />
              <EmployeePortalAgendaAction label="Heute" icon="today-outline" onPress={() => setAnchor(new Date())} />
              <PeriodArrow next onPress={() => navigate(1)} />
            </View>
          </View>
          <View style={styles.viewChoices} accessibilityRole="toolbar" accessibilityLabel="Kalenderansicht">
            {VIEWS.map(({ value, label }) => {
              const selected = viewMode === value;
              return (
                <Pressable key={value} accessibilityRole="button" aria-pressed={selected}
                  accessibilityState={Platform.OS === 'web' ? undefined : { selected }} onPress={() => setViewMode(value)}
                  style={({ hovered, focused, pressed }: { hovered?: boolean; focused?: boolean; pressed: boolean }) => [
                    styles.control, styles.viewChoice, layout.readableWidth < 295 && styles.viewChoiceCompact,
                    layout.readableWidth < 205 && styles.viewChoiceNarrow, selected && styles.selected,
                    hovered && !selected && styles.hover, focused && styles.focus, pressed && styles.pressed,
                  ]}>
                  <Text style={[styles.choiceLabel, selected && styles.selectedLabel]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {!initialLoading && !error && (periodEvents.length > 0 || filter !== 'all') ? (
          <View style={styles.filters} accessibilityRole="toolbar" accessibilityLabel="Kalendereinträge filtern">
            {FILTERS.map(({ value, label, color }) => {
              const selected = filter === value;
              return (
                <Pressable key={value} accessibilityRole="button" aria-pressed={selected}
                  accessibilityState={Platform.OS === 'web' ? undefined : { selected }}
                  accessibilityLabel={label + ', ' + counts[value] + (counts[value] === 1 ? ' Eintrag' : ' Einträge')}
                  onPress={() => setFilter(value)}
                  style={({ hovered, focused, pressed }: { hovered?: boolean; focused?: boolean; pressed: boolean }) => [
                    styles.control, styles.filter, selected && styles.filterSelected,
                    hovered && styles.hover, focused && styles.focus, pressed && styles.pressed,
                  ]}>
                  <View style={[styles.dot, { backgroundColor: color }]} />
                  <Text style={styles.choiceLabel}>{label}</Text>
                  <Text style={styles.count}>{counts[value]}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {refreshError && !error ? <InfoBanner variant="error" presentation="inline" onDarkSurface title="Aktualisierung nicht möglich"
          message={refreshError} actionLabel="Erneut versuchen" onAction={refreshCalendar} /> : null}
        {initialLoading ? <ClientRecordLoading message="Kalender wird geladen …" /> : null}
        {error ? <InfoBanner variant="error" presentation="inline" onDarkSurface title="Teamkalender nicht verfügbar"
          message={error} actionLabel="Erneut versuchen" onAction={refreshCalendar} /> : null}

        {!initialLoading && !error ? (
          visibleEvents.length === 0 && (agendaView || filter !== 'all') ? (
            <ClientRecordPanel title={filter === 'all' ? 'Keine Einträge im Zeitraum' : 'Keine passenden Einträge'} icon="calendar-outline">
              <Text style={styles.emptyText}>{filter === 'all'
                ? 'Wählen Sie einen anderen Zeitraum oder eine andere Ansicht.'
                : 'Für diesen Filter gibt es im gewählten Zeitraum keine Einträge.'}</Text>
              {filter !== 'all' ? (
                <View style={styles.heroActions}>
                  <EmployeePortalAgendaAction label="Alle Einträge anzeigen" icon="close-outline" onPress={() => setFilter('all')} />
                </View>
              ) : null}
            </ClientRecordPanel>
          ) : agendaView ? (
            <EmployeePortalCalendarAgenda events={visibleEvents} list={viewMode === 'list'} periodStart={start}
              columns={layout.twoColumns} employeeId={employeeId} onEventPress={openEvent} />
          ) : (
            <CalendarEventGrid appearance="employee" viewMode={viewMode} anchor={anchor} events={visibleEvents}
              weekStartDay={WEEK_START} maxCollapsedEvents={3} dayViewStartHour={6} weekFullDay
              onEventPress={openEvent} onSelectDate={openDay} onSelectMonth={openMonth} />
          )
        ) : null}
      </ClientRecordViewport>

      <PlatformModal visible={selectedEvent != null} title={selectedEvent?.title ?? 'Kalendereintrag'}
        onClose={() => setSelection(null)} variant={layout.compact ? 'bottomSheet' : 'center'} minWidth={0}
        footerActions={[{ title: 'Schließen', variant: 'secondary', onPress: () => setSelection(null) }]}>
        {selectedEvent ? <View style={styles.modalBody}>
          <Text style={careTypography.bodyStrong}>{formatEmployeeCalendarWhen(selectedEvent, true)}</Text>
          {selectedEvent.employeeName ? <Text style={careTypography.body}>{selectedEvent.employeeName}</Text> : null}
          {selectedEvent.clientName && selectedEvent.clientName !== selectedEvent.title
            ? <Text style={careTypography.body}>{selectedEvent.clientName}</Text> : null}
          {selectedEvent.record?.address || selectedEvent.record?.locationName
            ? <Text style={careTypography.body}>{selectedEvent.record.address || selectedEvent.record.locationName}</Text> : null}
          {selectedEvent.record?.publicNote ? <Text style={careTypography.body}>{selectedEvent.record.publicNote}</Text> : null}
        </View> : null}
      </PlatformModal>
    </>
  );
}

const styles = StyleSheet.create(withCareSuiteTypography({
  heroActions: { alignItems: 'flex-start' },
  controlPanel: { padding: 13, gap: 12, minWidth: 0, backgroundColor: c.panel, borderColor: c.line, borderWidth: 1, borderRadius: 16 },
  controlPanelCompact: { padding: 9, gap: 9 },
  periodRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  periodCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 195, minWidth: 0, gap: 2 },
  eyebrow: { color: c.accent, fontSize: font(10), lineHeight: font(15), letterSpacing: 1, textTransform: 'uppercase', fontWeight: '800' },
  periodTitle: { color: c.text, fontSize: font(23), lineHeight: font(30), fontWeight: '800', ...clientRecordTextWrap },
  periodTitleCompact: { fontSize: font(19), lineHeight: font(25) },
  periodButtons: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, maxWidth: '100%' },
  viewChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, minWidth: 0 },
  control: {
    minHeight: 44, minWidth: 0, maxWidth: '100%', justifyContent: 'center', alignItems: 'center',
    backgroundColor: c.control, borderWidth: 1, borderColor: c.line, borderRadius: 10,
  },
  arrow: { width: 44 },
  viewChoice: { flexGrow: 1, flexBasis: 68, paddingHorizontal: 8, paddingVertical: 5 },
  viewChoiceCompact: { flexBasis: '30%', paddingHorizontal: 2 },
  viewChoiceNarrow: { flexBasis: '45%' },
  choiceLabel: { flexShrink: 1, color: c.text, fontSize: font(13), lineHeight: font(18), fontWeight: '800', ...clientRecordTextWrap },
  selected: { backgroundColor: c.accent, borderColor: c.accent },
  selectedLabel: { color: c.canvas },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, minWidth: 0 },
  filter: { flexDirection: 'row', gap: 6, paddingHorizontal: 9, paddingVertical: 5 },
  filterSelected: { backgroundColor: c.selected, borderColor: c.accent },
  dot: { width: 7, height: 7, flexShrink: 0, borderRadius: 4 },
  count: {
    minWidth: 18, paddingHorizontal: 4, paddingVertical: 1, textAlign: 'center', color: c.accent,
    backgroundColor: c.raised, borderRadius: 5, fontSize: font(11), lineHeight: font(15), fontWeight: '800', fontVariant: ['tabular-nums'],
  },
  emptyText: { color: c.muted, fontSize: font(13), lineHeight: font(19), ...clientRecordTextWrap },
  modalBody: { gap: 12, minWidth: 0 },
  hover: { backgroundColor: c.selected, borderColor: c.accent },
  focus: { ...agendaFocusRing },
  pressed: { opacity: 0.8 },
}));
