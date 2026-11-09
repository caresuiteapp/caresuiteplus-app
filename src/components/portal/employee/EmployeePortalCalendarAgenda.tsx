import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { withCareSuiteTypography } from '@/design/withCareSuiteTypography';
import { webScaledFontMetric as font } from '@/design/web/webFontSize';
import { resolveAssignmentCalendarVisual } from '@/lib/calendar/assignmentCalendarPresentation.web';
import { isAssignmentCalendarEvent, resolveCalendarEventDisplay } from '@/lib/calendar/calendarEventDisplay';
import { calendarEventDateKey, groupCalendarEventsByDay } from '@/lib/calendar/calendarWebViewModel';
import { formatTime, isSameDay, parseDateKey, toDateKey } from '@/lib/office/calendarDateUtils';
import type { CalendarEvent } from '@/types/modules/calendarEvent';
import { agendaFocusRing } from './EmployeePortalAgendaAction';
import { clientRecordTextWrap } from './EmployeePortalClientRecordLayout';
import { employeePortalDesign as c } from './employeePortalDesign';

export const employeeCalendarCategories = {
  assignments: { label: 'Einsätze', singular: 'Einsatz', color: '#A8E8FF', icon: 'briefcase-outline' },
  appointments: { label: 'Termine', singular: 'Termin', color: '#DBCCFF', icon: 'calendar-outline' },
  absences: { label: 'Abwesenheiten', singular: 'Abwesenheit', color: '#FFE2A9', icon: 'time-outline' },
} as const;
export type EmployeeCalendarCategory = keyof typeof employeeCalendarCategories;

export function employeeCalendarCategory(event: CalendarEvent): EmployeeCalendarCategory {
  if (isAssignmentCalendarEvent(event)) return 'assignments';
  return ['urlaub', 'krank', 'abwesenheit'].includes(event.type) ? 'absences' : 'appointments';
}

export function formatEmployeeCalendarWhen(event: CalendarEvent, showDate = false): string {
  const firstKey = calendarEventDateKey(event);
  const lastKey = event.allDay ? event.end.slice(0, 10) : toDateKey(new Date(event.end));
  const crossesDates = firstKey !== lastKey;
  const date = (key: string) => parseDateKey(key).toLocaleDateString('de-DE', {
    day: 'numeric', month: 'short', year: firstKey.slice(0, 4) !== lastKey.slice(0, 4) ? 'numeric' : undefined,
  });
  if (event.allDay) {
    if (crossesDates) return `${date(firstKey)} – ${date(lastKey)} · ganztägig`;
    return showDate ? `${date(firstKey)} · ganztägig` : 'Ganztägig';
  }
  const from = formatTime(event.start);
  const to = formatTime(event.end);
  if (crossesDates) return `${date(firstKey)}, ${from} – ${date(lastKey)}, ${to} Uhr`;
  return `${showDate ? `${date(firstKey)} · ` : ''}${from} – ${to} Uhr`;
}

function CalendarEntry({ event, showDate, employeeId, onPress }: {
  event: CalendarEvent; showDate: boolean; employeeId: string | null; onPress: (event: CalendarEvent) => void;
}) {
  const display = resolveCalendarEventDisplay(event);
  const category = employeeCalendarCategories[employeeCalendarCategory(event)];
  const status = resolveAssignmentCalendarVisual(event);
  const employee = display.employeeName ?? event.employeeName?.trim();
  const own = display.isAssignment && employeeId && employeeId === (event.employeeId ?? event.record?.relatedEmployeeId);
  const time = formatEmployeeCalendarWhen(event, showDate);
  const type = own ? 'Eigener Einsatz' : category.singular;
  const label = [display.primaryLine, time, type, employee, status?.label].filter(Boolean).join(', ');
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => onPress(event)}
      style={({ hovered, focused, pressed }: { hovered?: boolean; focused?: boolean; pressed: boolean }) => [
        styles.entry, { borderLeftColor: category.color }, hovered && styles.hover, focused && styles.focus, pressed && styles.pressed,
      ]}>
      <View style={styles.entryTop}>
        <View style={styles.time}>
          <Ionicons name="time-outline" size={15} color={category.color} accessible={false} />
          <Text style={[styles.timeText, { color: category.color }]}>{time}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={c.muted} accessible={false} />
      </View>
      <Text style={styles.entryTitle}>{display.primaryLine}</Text>
      {employee || display.serviceTitle ? (
        <Text style={styles.entryDetail}>{[employee, display.serviceTitle].filter(Boolean).join(' · ')}</Text>
      ) : null}
      <View style={styles.badges}>
        <View style={styles.typeBadge}>
          <Ionicons name={category.icon} size={13} color={category.color} accessible={false} />
          <Text style={[styles.badgeLabel, { color: category.color }]}>{type}</Text>
        </View>
        {status ? (
          <View style={[styles.statusBadge, { backgroundColor: status.color }]}>
            <Text style={styles.statusLabel}>{status.symbol} {status.label}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

function CalendarEntries({ events, columns, showDate = false, employeeId, onEventPress }: {
  events: CalendarEvent[]; columns: boolean; showDate?: boolean; employeeId: string | null;
  onEventPress: (event: CalendarEvent) => void;
}) {
  const paired = columns && events.length > 1;
  return (
    <View style={[styles.entries, paired && styles.entriesPaired]}>
      {events.map(event => (
        <View key={event.id} style={paired ? styles.entryHalf : undefined}>
          <CalendarEntry event={event} showDate={showDate} employeeId={employeeId} onPress={onEventPress} />
        </View>
      ))}
    </View>
  );
}

export function EmployeePortalCalendarAgenda({ events, list, periodStart, columns, employeeId, onEventPress }: {
  events: CalendarEvent[]; list: boolean; periodStart: Date; columns: boolean; employeeId: string | null;
  onEventPress: (event: CalendarEvent) => void;
}) {
  const { continuing, days } = useMemo(() => {
    const firstKey = toDateKey(periodStart);
    const continuing: CalendarEvent[] = [];
    const days: [string, CalendarEvent[]][] = [];
    for (const [key, entries] of groupCalendarEventsByDay(events)) {
      if (key < firstKey) continuing.push(...entries);
      else days.push([key, entries]);
    }
    return { continuing, days };
  }, [events, periodStart]);
  const today = new Date();
  const entryProps = { employeeId, onEventPress };
  if (list) {
    return (
      <View style={styles.agenda} testID="employee-calendar-list">
        <Text accessibilityRole="header" aria-level={3} style={styles.dayTitle}>Alle Einträge im Zeitraum</Text>
        <CalendarEntries {...entryProps} events={[...continuing, ...days.flatMap(([, entries]) => entries)]} columns={columns} showDate />
      </View>
    );
  }
  return (
    <View style={styles.agenda} testID="employee-calendar-agenda">
      {continuing.length > 0 ? (
        <View style={[styles.day, styles.continuing]}>
          <View style={styles.dayHeading}>
            <View style={styles.continuingIcon}>
              <Ionicons name="calendar-outline" size={22} color={c.warning} accessible={false} />
            </View>
            <View style={styles.dayCopy}>
              <Text accessibilityRole="header" aria-level={3} style={styles.dayTitle}>Bereits laufende Einträge</Text>
              <Text style={styles.dayNote}>Begannen vor dem gewählten Zeitraum.</Text>
            </View>
          </View>
          <CalendarEntries {...entryProps} events={continuing} columns={columns} showDate />
        </View>
      ) : null}
      {days.map(([key, entries]) => {
        const day = parseDateKey(key);
        const isToday = isSameDay(day, today);
        return (
          <View key={key} style={styles.day}>
            <View style={styles.dayHeading}>
              <View style={[styles.datePlate, isToday && styles.datePlateToday]} aria-hidden>
                <Text style={[styles.dateNumber, isToday && styles.todayInk]}>{day.getDate()}</Text>
                <Text style={[styles.dateMonth, isToday && styles.todayInk]}>{day.toLocaleDateString('de-DE', { month: 'short' })}</Text>
              </View>
              <View style={styles.dayCopy}>
                <Text accessibilityRole="header" aria-level={3} style={styles.dayTitle}>
                  {day.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
                </Text>
                <Text style={styles.dayNote}>{isToday ? 'Heute · ' : ''}{entries.length} {entries.length === 1 ? 'Eintrag' : 'Einträge'}</Text>
              </View>
            </View>
            <CalendarEntries {...entryProps} events={entries} columns={columns} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create(withCareSuiteTypography({
  agenda: { gap: 14, minWidth: 0 },
  day: { gap: 11, padding: 11, minWidth: 0, backgroundColor: c.panel, borderWidth: 1, borderColor: c.line, borderRadius: 17 },
  continuing: { backgroundColor: 'rgba(255,215,146,0.075)', borderColor: 'rgba(255,219,167,0.30)' },
  dayHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
  dayCopy: { flex: 1, minWidth: 0, gap: 2 },
  dayTitle: { color: c.text, fontSize: font(17), lineHeight: font(23), fontWeight: '800', ...clientRecordTextWrap },
  dayNote: { color: c.muted, fontSize: font(12), lineHeight: font(17), ...clientRecordTextWrap },
  datePlate: { minWidth: 45, alignItems: 'center', paddingHorizontal: 6, paddingVertical: 5, borderRadius: 10, backgroundColor: c.control },
  datePlateToday: { backgroundColor: c.accent },
  dateNumber: { color: c.text, fontSize: font(20), lineHeight: font(23), fontWeight: '800', fontVariant: ['tabular-nums'] },
  dateMonth: { color: c.accent, fontSize: font(10), lineHeight: font(15), fontWeight: '700' },
  todayInk: { color: c.canvas },
  continuingIcon: { width: 45, height: 45, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: 'rgba(255,215,146,0.12)' },
  entries: { minWidth: 0, gap: 8 },
  entriesPaired: { flexDirection: 'row', flexWrap: 'wrap', gap: 0, rowGap: 8, marginHorizontal: -4 },
  entryHalf: { width: '50%', minWidth: 0, paddingHorizontal: 4 },
  entry: {
    flex: 1, minWidth: 0, gap: 5, padding: 11, borderRadius: 11, borderWidth: 1, borderLeftWidth: 3,
    borderColor: c.line, backgroundColor: c.control,
  },
  entryTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6, minWidth: 0 },
  time: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  timeText: { flexShrink: 1, fontSize: font(12), lineHeight: font(17), fontWeight: '800', fontVariant: ['tabular-nums'], ...clientRecordTextWrap },
  entryTitle: { color: c.text, fontSize: font(16), lineHeight: font(21), fontWeight: '800', ...clientRecordTextWrap },
  entryDetail: { color: c.muted, fontSize: font(12), lineHeight: font(17), ...clientRecordTextWrap },
  badges: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5, marginTop: 3 },
  typeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: c.raised },
  badgeLabel: { flexShrink: 1, fontSize: font(10), lineHeight: font(15), fontWeight: '800', ...clientRecordTextWrap },
  statusBadge: { maxWidth: '100%', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  statusLabel: { color: '#fff', fontSize: font(10), lineHeight: font(15), fontWeight: '800', ...clientRecordTextWrap },
  hover: { backgroundColor: c.selected },
  focus: { ...agendaFocusRing },
  pressed: { opacity: 0.8 },
}));
