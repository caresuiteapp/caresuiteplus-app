import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { CalendarEvent } from '@/types/modules/calendarEvent';
import { CalendarEventLabel } from '@/components/calendar/CalendarEventLabel';
import { auroraGlass, useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careRadius } from '@/design/tokens/radius';
import { formatTime } from '@/lib/office/calendarDateUtils';
import { isAssignmentCalendarEvent } from '@/lib/calendar/calendarEventDisplay';

type OfficeCalendarEventChipProps = {
  event: CalendarEvent;
  compact?: boolean;
  showTime?: boolean;
  onEventPress?: (event: CalendarEvent) => void;
};

export function OfficeCalendarEventChip({
  event,
  compact = false,
  showTime = true,
  onEventPress,
}: OfficeCalendarEventChipProps) {
  const text = useAuroraAdaptiveText();
  const router = useRouter();
  const isAssignment = isAssignmentCalendarEvent(event);
  const timeLabel = event.allDay ? 'Ganztägig' : formatTime(event.start);

  const content = (
    <View style={[styles.chip, compact && styles.chipCompact, { borderLeftColor: event.color }]}>
      {!isAssignment && !event.allDay && showTime && !compact ? (
        <Text style={[styles.time, { color: text.muted }]}>{timeLabel}</Text>
      ) : null}
      <CalendarEventLabel
        event={event}
        variant={compact ? 'compact' : 'stacked'}
        showTime={isAssignment ? showTime : false}
        showService={!compact}
        numberOfLines={compact ? 2 : 3}
      />
    </View>
  );

  if (onEventPress) {
    return (
      <Pressable onPress={() => onEventPress(event)} accessibilityRole="button">
        {content}
      </Pressable>
    );
  }

  if (!event.href) return content;

  return (
    <Pressable onPress={() => router.push(event.href as never)} accessibilityRole="link">
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderLeftWidth: 3,
    backgroundColor: auroraGlass.chip,
    borderRadius: careRadius.sm,
    paddingHorizontal: 6,
    paddingVertical: 4,
    marginBottom: 2,
  },
  chipCompact: {
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  time: {
    fontSize: 10,
    marginBottom: 1,
  },
});
