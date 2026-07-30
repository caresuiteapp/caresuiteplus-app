import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { CalendarEvent, WeekStartDay } from '@/types/modules/calendarEvent';
import { GlassCard } from '@/design/components/GlassCard';
import { auroraGlass, useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';
import {
  eventsForDay,
  formatMonthYear,
  getMonthGridDays,
  isSameDay,
  orderedWeekdayLabels,
  toDateKey,
} from '@/lib/office/calendarDateUtils';
import { OfficeCalendarEventChip } from './OfficeCalendarEventChip';
import {
  buildAssignmentProfileDropTargetProps,
  type AssignmentProfileDropHandler,
} from '@/components/calendar/OfficeAssignmentProfileCalendarPlanner';

type OfficeCalendarMonthViewProps = {
  anchor: Date;
  events: CalendarEvent[];
  weekStartDay: WeekStartDay;
  maxCollapsedEvents: number;
  onEventPress?: (event: CalendarEvent) => void;
  selectedAssignmentProfileId?: string | null;
  onAssignmentProfileDrop?: AssignmentProfileDropHandler;
};

export function OfficeCalendarMonthView({
  anchor,
  events,
  weekStartDay,
  maxCollapsedEvents,
  onEventPress,
  selectedAssignmentProfileId,
  onAssignmentProfileDrop,
}: OfficeCalendarMonthViewProps) {
  const text = useAuroraAdaptiveText();
  const today = new Date();
  const [expandedDays, setExpandedDays] = useState<Set<string>>(() => new Set());

  const gridDays = useMemo(
    () => getMonthGridDays(anchor, weekStartDay),
    [anchor, weekStartDay],
  );
  const weekdayLabels = orderedWeekdayLabels(weekStartDay);

  const toggleDay = (key: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <GlassCard style={styles.card}>
      <Text style={[styles.monthTitle, { color: text.primary }]}>{formatMonthYear(anchor)}</Text>
      <View style={styles.weekHeader}>
        {weekdayLabels.map((label) => (
          <Text key={label} style={[styles.weekday, { color: text.muted }]}>
            {label}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {gridDays.map(({ date, inMonth }) => {
          const key = toDateKey(date);
          const dayEvents = eventsForDay(events, date);
          const expanded = expandedDays.has(key);
          const visible = expanded ? dayEvents : dayEvents.slice(0, maxCollapsedEvents);
          const hiddenCount = dayEvents.length - visible.length;
          const isToday = isSameDay(date, today);

          return (
            <Pressable
              key={key}
              onPress={
                selectedAssignmentProfileId && onAssignmentProfileDrop
                  ? () => onAssignmentProfileDrop(selectedAssignmentProfileId, date)
                  : undefined
              }
              {...buildAssignmentProfileDropTargetProps(date, onAssignmentProfileDrop)}
              style={[
                styles.cell,
                !inMonth && styles.cellOutside,
                isToday && styles.cellToday,
                selectedAssignmentProfileId && styles.cellDropReady,
              ]}
            >
              <Text style={[styles.dayNum, { color: !inMonth ? text.muted : text.primary }]}>{date.getDate()}</Text>
              <View style={styles.events}>
                {visible.map((event) => (
                  <OfficeCalendarEventChip
                    key={event.id}
                    event={event}
                    compact
                    onEventPress={onEventPress}
                  />
                ))}
              </View>
              {hiddenCount > 0 ? (
                <Pressable onPress={() => toggleDay(key)} style={styles.moreBtn}>
                  <Text style={[styles.moreLabel, { color: text.secondary }]}>+{hiddenCount} mehr</Text>
                </Pressable>
              ) : null}
              {expanded && dayEvents.length > maxCollapsedEvents ? (
                <Pressable onPress={() => toggleDay(key)} style={styles.moreBtn}>
                  <Text style={[styles.moreLabel, { color: text.secondary }]}>− weniger</Text>
                </Pressable>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: careSpacing.md,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: careSpacing.sm,
  },
  weekHeader: {
    flexDirection: 'row',
    marginBottom: careSpacing.xs,
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%` as unknown as number,
    minHeight: 96,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: auroraGlass.innerBorder,
    padding: 4,
    backgroundColor: auroraGlass.row,
  },
  cellOutside: {
    opacity: 0.45,
  },
  cellToday: {
    backgroundColor: auroraGlass.rowSelected,
    borderRadius: careRadius.sm,
  },
  cellDropReady: {
    borderColor: '#2388FF',
  },
  dayNum: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  events: {
    flex: 1,
  },
  moreBtn: {
    marginTop: 2,
  },
  moreLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
});
