import { useMemo, useRef, useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { CalendarEvent } from '@/types/modules/calendarEvent';
import { GlassCard } from '@/design/components/GlassCard';
import { auroraGlass, useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import {
  eventsForDay,
  formatDayHeader,
  isSameDay,
} from '@/lib/office/calendarDateUtils';
import { CalendarEventLabel } from '@/components/calendar/CalendarEventLabel';
import { OfficeCalendarEventChip } from './OfficeCalendarEventChip';

type OfficeCalendarDayViewProps = {
  anchor: Date;
  events: CalendarEvent[];
  dayViewStartHour: number;
  onEventPress?: (event: CalendarEvent) => void;
};

const HOUR_HEIGHT = 56;

export function OfficeCalendarDayView({
  anchor,
  events,
  dayViewStartHour,
  onEventPress,
}: OfficeCalendarDayViewProps) {
  const text = useAuroraAdaptiveText();
  const scrollRef = useRef<ScrollView>(null);
  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);

  const dayEvents = useMemo(() => eventsForDay(events, anchor), [events, anchor]);
  const allDay = dayEvents.filter((e) => e.allDay);
  const timed = dayEvents.filter((e) => !e.allDay);

  useEffect(() => {
    const y = dayViewStartHour * HOUR_HEIGHT;
    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y, animated: false });
    });
    return () => cancelAnimationFrame(frame);
  }, [anchor, dayViewStartHour]);

  return (
    <GlassCard style={styles.card}>
      <Text style={[styles.title, { color: text.primary }]}>{formatDayHeader(anchor)}</Text>

      {allDay.length > 0 ? (
        <View style={styles.allDay}>
          <Text style={[styles.allDayLabel, { color: text.muted }]}>Ganztägig</Text>
          {allDay.map((event) => (
            <OfficeCalendarEventChip key={event.id} event={event} onEventPress={onEventPress} />
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
                  {slotEvents.map((event) => {
                    const blockStyle = [styles.eventBlock, { borderLeftColor: event.color }];
                    const inner = (
                      <CalendarEventLabel event={event} variant="stacked" showService />
                    );
                    if (onEventPress) {
                      return (
                        <Pressable
                          key={event.id}
                          onPress={() => onEventPress(event)}
                          style={blockStyle}
                        >
                          {inner}
                        </Pressable>
                      );
                    }
                    return (
                      <View key={event.id} style={blockStyle}>
                        {inner}
                      </View>
                    );
                  })}
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
});
