import { useMemo, useRef, useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { CalendarEvent } from '@/types/modules/calendarEvent';
import { GlassCard } from '@/design/components/GlassCard';
import { auroraGlass, useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import {
  eventsForDay,
  formatDayHeader,
  formatTime,
  isSameDay,
} from '@/lib/office/calendarDateUtils';
import { OfficeCalendarEventChip } from './OfficeCalendarEventChip';

type OfficeCalendarDayViewProps = {
  anchor: Date;
  events: CalendarEvent[];
  dayViewStartHour: number;
};

const HOUR_HEIGHT = 56;

export function OfficeCalendarDayView({
  anchor,
  events,
  dayViewStartHour,
}: OfficeCalendarDayViewProps) {
  const text = useAuroraAdaptiveText();
  const scrollRef = useRef<ScrollView>(null);
  const hours = useMemo(() => {
    const list: number[] = [];
    for (let h = dayViewStartHour; h < 24; h += 1) list.push(h);
    return list;
  }, [dayViewStartHour]);

  const dayEvents = useMemo(() => eventsForDay(events, anchor), [events, anchor]);
  const allDay = dayEvents.filter((e) => e.allDay);
  const timed = dayEvents.filter((e) => !e.allDay);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [anchor, dayViewStartHour]);

  return (
    <GlassCard style={styles.card}>
      <Text style={[styles.title, { color: text.primary }]}>{formatDayHeader(anchor)}</Text>

      {allDay.length > 0 ? (
        <View style={styles.allDay}>
          <Text style={[styles.allDayLabel, { color: text.muted }]}>Ganztägig</Text>
          {allDay.map((event) => (
            <OfficeCalendarEventChip key={event.id} event={event} />
          ))}
        </View>
      ) : null}

      <ScrollView ref={scrollRef} style={styles.scroll} nestedScrollEnabled>
        <View style={styles.grid}>
          {hours.map((h) => {
            const slotEvents = timed.filter((event) => {
              const start = new Date(event.start);
              return isSameDay(start, anchor) && start.getHours() === h;
            });
            return (
              <View key={h} style={[styles.row, { minHeight: HOUR_HEIGHT }]}>
                <Text style={[styles.hour, { color: text.muted }]}>{String(h).padStart(2, '0')}:00</Text>
                <View style={styles.slot}>
                  {slotEvents.map((event) => (
                    <View
                      key={event.id}
                      style={[styles.eventBlock, { borderLeftColor: event.color }]}
                    >
                      <Text style={[styles.eventTitle, { color: text.primary }]}>{event.title}</Text>
                      <Text style={[styles.eventMeta, { color: text.muted }]}>
                        {formatTime(event.start)} – {formatTime(event.end)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: careSpacing.md },
  title: { fontSize: 16, fontWeight: '700', marginBottom: careSpacing.md },
  allDay: {
    marginBottom: careSpacing.md,
    padding: careSpacing.sm,
    borderRadius: 8,
    backgroundColor: auroraGlass.chip,
    gap: careSpacing.xs,
  },
  allDayLabel: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  scroll: { maxHeight: 560 },
  grid: { gap: 0 },
  row: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: auroraGlass.innerBorder,
  },
  hour: {
    width: 52,
    paddingTop: 4,
    fontSize: 11,
  },
  slot: {
    flex: 1,
    paddingVertical: 4,
    paddingRight: careSpacing.sm,
    gap: 4,
  },
  eventBlock: {
    borderLeftWidth: 3,
    backgroundColor: auroraGlass.chip,
    borderRadius: 6,
    padding: careSpacing.sm,
  },
  eventTitle: { fontSize: 14, fontWeight: '600' },
  eventMeta: { fontSize: 12, marginTop: 2 },
});
