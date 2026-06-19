import { useEffect, useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { CalendarEvent, WeekStartDay } from '@/types/modules/calendarEvent';
import { GlassCard } from '@/design/components/GlassCard';
import { auroraGlass, useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import {
  eventsForDay,
  formatTime,
  formatWeekRange,
  getWeekDays,
  isSameDay,
  toDateKey,
} from '@/lib/office/calendarDateUtils';
import { OfficeCalendarEventChip } from './OfficeCalendarEventChip';

type OfficeCalendarWeekViewProps = {
  anchor: Date;
  events: CalendarEvent[];
  weekStartDay: WeekStartDay;
  weekFullDay: boolean;
  dayViewStartHour: number;
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
}: OfficeCalendarWeekViewProps) {
  const text = useAuroraAdaptiveText();
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
              return (
                <View key={toDateKey(day)} style={[styles.dayCol, isToday && styles.dayColToday]}>
                  <Text style={[styles.dayLabel, { color: text.muted }]}>
                    {day.toLocaleDateString('de-DE', { weekday: 'short' })}
                  </Text>
                  <Text style={[styles.dayNum, { color: text.primary }]}>{day.getDate()}</Text>
                </View>
              );
            })}
          </View>

          <View style={styles.allDayRow}>
            <Text style={[styles.allDayLabel, { color: text.muted }]}>GT</Text>
            {days.map((day) => {
              const allDay = eventsForDay(events, day).filter((e) => e.allDay);
              return (
                <View key={`allday-${toDateKey(day)}`} style={styles.allDayCol}>
                  {allDay.map((event) => (
                    <OfficeCalendarEventChip key={event.id} event={event} compact />
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
                return (
                  <View key={toDateKey(day)} style={styles.dayGrid}>
                    {hours.map((h) => (
                      <View
                        key={h}
                        style={[styles.slot, { height: HOUR_HEIGHT, borderColor: auroraGlass.innerBorder }]}
                      />
                    ))}
                    {dayEvents.map((event) => {
                      const pos = eventTopAndHeight(event, day, hours);
                      if (!pos) return null;
                      return (
                        <View
                          key={event.id}
                          style={[
                            styles.timedEvent,
                            {
                              top: pos.top,
                              height: pos.height,
                              borderLeftColor: event.color,
                            },
                          ]}
                        >
                          <Text style={[styles.timedTitle, { color: text.primary }]} numberOfLines={2}>
                            {event.title}
                          </Text>
                          <Text style={[styles.timedMeta, { color: text.muted }]}>
                            {formatTime(event.start)} – {formatTime(event.end)}
                          </Text>
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
    borderLeftWidth: 3,
    backgroundColor: auroraGlass.chip,
    borderRadius: 4,
    padding: 4,
    overflow: 'hidden',
  },
  timedTitle: { fontSize: 11, fontWeight: '600' },
  timedMeta: { fontSize: 9 },
});
