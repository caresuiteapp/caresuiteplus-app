import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { CalendarEvent } from '@/types/modules/calendarEvent';
import { GlassCard } from '@/design/components/GlassCard';
import { auroraGlass, useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { formatDayHeader, formatTime } from '@/lib/office/calendarDateUtils';
import { OfficeCalendarEventChip } from '@/components/office/calendar/OfficeCalendarEventChip';

type CalendarAgendaListProps = {
  events: CalendarEvent[];
  onEventPress?: (event: CalendarEvent) => void;
};

function groupEventsByDate(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const groups = new Map<string, CalendarEvent[]>();
  const sorted = [...events].sort((a, b) => a.start.localeCompare(b.start));
  for (const event of sorted) {
    const dayKey = event.start.slice(0, 10);
    const list = groups.get(dayKey) ?? [];
    list.push(event);
    groups.set(dayKey, list);
  }
  return groups;
}

export function CalendarAgendaList({ events, onEventPress }: CalendarAgendaListProps) {
  const text = useAuroraAdaptiveText();
  const grouped = useMemo(() => groupEventsByDate(events), [events]);
  const dayKeys = useMemo(() => [...grouped.keys()].sort(), [grouped]);

  return (
    <ScrollView style={styles.scroll} nestedScrollEnabled>
      {dayKeys.map((dayKey) => {
        const dayEvents = grouped.get(dayKey) ?? [];
        const headerDate = new Date(`${dayKey}T12:00:00`);
        return (
          <GlassCard key={dayKey} style={styles.dayGroup}>
            <Text style={[styles.dayHeader, { color: text.primary }]}>
              {formatDayHeader(headerDate)}
            </Text>
            {dayEvents.map((event) => (
              <Pressable
                key={event.id}
                onPress={() => onEventPress?.(event)}
                style={styles.row}
                accessibilityRole="button"
              >
                <Text style={[styles.time, { color: text.muted }]}>
                  {event.allDay ? 'Ganztägig' : formatTime(event.start)}
                </Text>
                <View style={styles.chipWrap}>
                  <OfficeCalendarEventChip event={event} onEventPress={onEventPress} />
                </View>
              </Pressable>
            ))}
          </GlassCard>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  dayGroup: { marginBottom: careSpacing.md, padding: careSpacing.md },
  dayHeader: { fontSize: 15, fontWeight: '700', marginBottom: careSpacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: careSpacing.sm,
    marginBottom: careSpacing.xs,
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: auroraGlass.border,
  },
  time: { width: 72, fontSize: 12, paddingTop: 6 },
  chipWrap: { flex: 1 },
});
