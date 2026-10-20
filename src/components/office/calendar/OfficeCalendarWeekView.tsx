import { useEffect, useMemo, useRef } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { CalendarEvent, WeekStartDay } from '@/types/modules/calendarEvent';
import { GlassCard } from '@/design/components/GlassCard';
import { auroraGlass, useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { portalPremium, usePortalPremiumTheme } from '@/design/tokens/portalPremium';
import {
  eventsForDay,
  formatWeekRange,
  getWeekDays,
  isSameDay,
  toDateKey,
} from '@/lib/office/calendarDateUtils';
import { CalendarEventLabel } from '@/components/calendar/CalendarEventLabel';
import {
  assignmentProfileClickCount,
  useAssignmentProfileDateSelection,
} from '@/components/calendar/AssignmentProfileDateSelection';
import { OfficeCalendarEventChip } from './OfficeCalendarEventChip';
import {
  buildAssignmentProfileDropTargetProps,
  type AssignmentProfileDropHandler,
} from '@/components/calendar/OfficeAssignmentProfileCalendarPlanner';
import { resolveAssignmentCalendarVisual } from '@/lib/calendar/assignmentCalendarStatus';

type OfficeCalendarWeekViewProps = {
  anchor: Date;
  events: CalendarEvent[];
  weekStartDay: WeekStartDay;
  weekFullDay: boolean;
  dayViewStartHour: number;
  onEventPress?: (event: CalendarEvent) => void;
  selectedAssignmentProfileId?: string | null;
  onAssignmentProfileDrop?: AssignmentProfileDropHandler;
};

const HOUR_HEIGHT = 48;
const BUSINESS_START = 7;
const BUSINESS_END = 20;

function hourRange(weekFullDay: boolean): number[] {
  if (weekFullDay) return Array.from({ length: 24 }, (_, i) => i);
  const hours: number[] = [];
  for (let h = BUSINESS_START; h <= BUSINESS_END; h += 1) hours.push(h);
  return hours;
}

function eventTopAndHeight(
  event: CalendarEvent,
  day: Date,
  hours: number[],
): { top: number; height: number } | null {
  if (event.allDay) return null;
  const start = new Date(event.start);
  const end = new Date(event.end);
  if (!isSameDay(start, day) && !isSameDay(end, day)) {
    if (start < day && end > day) {
      return { top: 0, height: hours.length * HOUR_HEIGHT };
    }
  }
  const startHour = isSameDay(start, day) ? start.getHours() + start.getMinutes() / 60 : hours[0];
  const endHour = isSameDay(end, day) ? end.getHours() + end.getMinutes() / 60 : hours[hours.length - 1] + 1;
  const base = hours[0];
  const top = Math.max(0, (startHour - base) * HOUR_HEIGHT);
  const height = Math.max(HOUR_HEIGHT * 0.5, (endHour - startHour) * HOUR_HEIGHT);
  return { top, height };
}

export function OfficeCalendarWeekView({
  anchor,
  events,
  weekStartDay,
  weekFullDay,
  dayViewStartHour,
  onEventPress,
  selectedAssignmentProfileId,
  onAssignmentProfileDrop,
}: OfficeCalendarWeekViewProps) {
  const text = useAuroraAdaptiveText();
  const portal = usePortalPremiumTheme();
  const dateSelection = useAssignmentProfileDateSelection();
  const gridScrollRef = useRef<ScrollView>(null);
  const days = useMemo(() => getWeekDays(anchor, weekStartDay), [anchor, weekStartDay]);
  const hours = useMemo(() => hourRange(weekFullDay), [weekFullDay]);
  const today = new Date();

  useEffect(() => {
    if (!weekFullDay) {
      gridScrollRef.current?.scrollTo({ y: 0, animated: false });
      return;
    }
    const y = dayViewStartHour * HOUR_HEIGHT;
    const frame = requestAnimationFrame(() => {
      gridScrollRef.current?.scrollTo({ y, animated: false });
    });
    return () => cancelAnimationFrame(frame);
  }, [anchor, dayViewStartHour, weekFullDay]);

  return (
    <GlassCard style={styles.card}>
      <Text style={[styles.title, { color: text.primary }]}>{formatWeekRange(anchor, weekStartDay)}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={styles.headerRow}>
            <View style={styles.timeGutter} />
            {days.map((day) => {
              const isToday = isSameDay(day, today);
              const selected = dateSelection?.selectedDateKeys.includes(toDateKey(day)) ?? false;
              const headerStyle = [
                styles.dayCol,
                dateSelection && styles.dayColSelectable,
                portal.active && styles.portalBorder,
                isToday && styles.dayColToday,
                isToday && portal.active && styles.portalToday,
                selected && styles.dayColSelected,
              ];
              const headerContent = (
                <>
                  <Text style={[styles.dayLabel, { color: text.muted }]}>
                    {day.toLocaleDateString('de-DE', { weekday: 'short' })}
                  </Text>
                  <Text style={[styles.dayNum, { color: text.primary }]}>{day.getDate()}</Text>
                  {selected ? (
                    <View pointerEvents="none" style={styles.selectionMarkPosition}>
                      <Text accessible={false} style={styles.selectionMark}>✓</Text>
                    </View>
                  ) : null}
                </>
              );
              if (dateSelection) {
                return (
                  <Pressable
                    key={toDateKey(day)}
                    style={headerStyle}
                    disabled={dateSelection.disabled}
                    onPress={(event) => {
                      if (!dateSelection.disabled) dateSelection.selectDate(day, assignmentProfileClickCount(event));
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`${day.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}, ${selected ? 'für das Einsatzprofil ausgewählt' : 'für das Einsatzprofil auswählen'}`}
                    accessibilityState={{ selected, disabled: dateSelection.disabled }}
                    accessibilityHint="Ein Klick ändert die Auswahl. Ein Doppelklick wählt nur diesen Tag."
                  >
                    {headerContent}
                  </Pressable>
                );
              }
              return (
                <View
                  key={toDateKey(day)}
                  style={headerStyle}
                >
                  <Text style={[styles.dayLabel, { color: text.muted }]}>
                    {day.toLocaleDateString('de-DE', { weekday: 'short' })}
                  </Text>
                  <Text style={[styles.dayNum, { color: text.primary }]}>{day.getDate()}</Text>
                </View>
              );
            })}
          </View>

          <View style={[styles.allDayRow, portal.active && styles.portalBorder]}>
            <Text style={[styles.allDayLabel, { color: text.muted }]}>GT</Text>
            {days.map((day) => {
              const allDay = eventsForDay(events, day).filter((e) => e.allDay);
              const selected = dateSelection?.selectedDateKeys.includes(toDateKey(day)) ?? false;
              return (
                <View key={`allday-${toDateKey(day)}`} style={[styles.allDayCol, selected && styles.selectedSurface]}>
                  {allDay.map((event) => (
                    <OfficeCalendarEventChip
                      key={event.id}
                      event={event}
                      compact
                      onEventPress={onEventPress}
                    />
                  ))}
                </View>
              );
            })}
          </View>

          <ScrollView ref={gridScrollRef} style={styles.gridScroll} nestedScrollEnabled>
            <View style={styles.grid}>
              <View style={styles.timeCol}>
                {hours.map((h) => (
                  <View key={h} style={[styles.hourCell, { height: HOUR_HEIGHT }]}>
                    <Text style={[styles.hourLabel, { color: text.muted }]}>{String(h).padStart(2, '0')}:00</Text>
                  </View>
                ))}
              </View>
              {days.map((day) => {
                const dayEvents = eventsForDay(events, day).filter((e) => !e.allDay);
                const selected = dateSelection?.selectedDateKeys.includes(toDateKey(day)) ?? false;
                return (
                  <View key={toDateKey(day)} style={[styles.dayGrid, selected && styles.selectedSurface]}>
                    {hours.map((h) => (
                      <Pressable
                        key={h}
                        onPress={
                          dateSelection
                            ? (event) => {
                                if (!dateSelection.disabled) {
                                  dateSelection.selectDate(day, assignmentProfileClickCount(event), `${String(h).padStart(2, '0')}:00`);
                                }
                              }
                            : selectedAssignmentProfileId && onAssignmentProfileDrop
                            ? () =>
                                onAssignmentProfileDrop(
                                  selectedAssignmentProfileId,
                                  day,
                                  `${String(h).padStart(2, '0')}:00`,
                                )
                            : undefined
                        }
                        disabled={dateSelection?.disabled}
                        accessibilityRole={dateSelection ? 'button' : undefined}
                        accessibilityLabel={dateSelection ? `${day.toLocaleDateString('de-DE')}, ${selected ? 'für das Einsatzprofil ausgewählt' : 'für das Einsatzprofil auswählen'}, Zeitvorschlag ${String(h).padStart(2, '0')}:00 Uhr` : undefined}
                        accessibilityState={dateSelection ? { selected, disabled: dateSelection.disabled } : undefined}
                        {...buildAssignmentProfileDropTargetProps(
                          day,
                          onAssignmentProfileDrop,
                          `${String(h).padStart(2, '0')}:00`,
                        )}
                        style={[
                          styles.slot,
                          {
                            height: HOUR_HEIGHT,
                            borderColor: portal.active
                              ? portalPremium.borderSoft
                              : auroraGlass.innerBorder,
                          },
                        ]}
                      />
                    ))}
                    {dayEvents.map((event) => {
                      const pos = eventTopAndHeight(event, day, hours);
                      if (!pos) return null;
                      const assignmentVisual = resolveAssignmentCalendarVisual(event);
                      const eventStyle = [
                        styles.timedEvent,
                        portal.active && styles.portalEvent,
                        {
                          top: pos.top,
                          height: pos.height,
                          backgroundColor: assignmentVisual?.tint ?? auroraGlass.chip,
                          borderColor: assignmentVisual?.outline ?? 'transparent',
                          borderLeftColor: assignmentVisual?.color ?? event.color,
                        },
                      ];
                      const inner = (
                        <CalendarEventLabel
                          event={event}
                          variant="stacked"
                          showService={pos.height >= HOUR_HEIGHT}
                          numberOfLines={pos.height >= HOUR_HEIGHT * 1.5 ? 4 : 3}
                        />
                      );
                      if (onEventPress) {
                        return (
                          <Pressable
                            key={event.id}
                            onPress={(pressEvent) => {
                              if (Platform.OS === 'web') pressEvent.stopPropagation();
                              onEventPress(event);
                            }}
                            style={eventStyle}
                          >
                            {inner}
                          </Pressable>
                        );
                      }
                      return (
                        <View key={event.id} style={eventStyle}>
                          {inner}
                        </View>
                      );
                    })}
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </ScrollView>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: careSpacing.md },
  title: { fontSize: 16, fontWeight: '700', marginBottom: careSpacing.sm },
  headerRow: { flexDirection: 'row' },
  timeGutter: { width: 48 },
  dayCol: {
    width: 120,
    alignItems: 'center',
    paddingVertical: careSpacing.xs,
    borderBottomWidth: 1,
    borderColor: auroraGlass.border,
  },
  dayColToday: { backgroundColor: auroraGlass.rowSelected },
  dayColSelectable: { borderBottomWidth: 3 },
  dayColSelected: {
    backgroundColor: 'rgba(35, 136, 255, 0.18)',
    borderColor: '#0866C2',
  },
  selectionMarkPosition: {
    position: 'absolute',
    top: 16,
    right: 8,
  },
  selectionMark: {
    width: 18,
    height: 18,
    lineHeight: 18,
    borderRadius: 9,
    textAlign: 'center',
    color: '#FFFFFF',
    backgroundColor: '#0866C2',
    fontSize: 12,
    fontWeight: '800',
  },
  selectedSurface: { backgroundColor: 'rgba(35, 136, 255, 0.12)' },
  dayLabel: { fontSize: 11 },
  dayNum: { fontSize: 16, fontWeight: '700' },
  allDayRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: auroraGlass.border },
  allDayLabel: { width: 48, fontSize: 10, textAlign: 'center', paddingTop: 6 },
  allDayCol: { width: 120, padding: 4, minHeight: 28 },
  gridScroll: { maxHeight: 520 },
  grid: { flexDirection: 'row' },
  timeCol: { width: 48 },
  hourCell: { justifyContent: 'flex-start', paddingTop: 2 },
  hourLabel: { fontSize: 10 },
  dayGrid: { width: 120, position: 'relative' },
  slot: { borderBottomWidth: StyleSheet.hairlineWidth },
  timedEvent: {
    position: 'absolute',
    left: 2,
    right: 2,
    borderWidth: 1,
    borderLeftWidth: 4,
    backgroundColor: auroraGlass.chip,
    borderRadius: 4,
    padding: 4,
    overflow: 'hidden',
  },
  portalBorder: { borderColor: portalPremium.borderSoft },
  portalToday: { backgroundColor: portalPremium.surfaceMuted },
  portalEvent: { backgroundColor: portalPremium.surfaceSoft },
});
