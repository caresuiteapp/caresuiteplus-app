import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { CalendarEvent } from '@/types/modules/calendarEvent';
import { auroraGlass, useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careRadius } from '@/design/tokens/radius';
import { formatTime } from '@/lib/office/calendarDateUtils';

type OfficeCalendarEventChipProps = {
  event: CalendarEvent;
  compact?: boolean;
  onEventPress?: (event: CalendarEvent) => void;
};

export function OfficeCalendarEventChip({
  event,
  compact = false,
  onEventPress,
}: OfficeCalendarEventChipProps) {
  const text = useAuroraAdaptiveText();
  const router = useRouter();
  const timeLabel = event.allDay ? 'Ganztägig' : formatTime(event.start);

  const content = (
    <View style={[styles.chip, compact && styles.chipCompact, { borderLeftColor: event.color }]}>
      {!event.allDay && !compact ? (
        <Text style={[styles.time, { color: text.muted }]}>{timeLabel}</Text>
      ) : null}
      <Text style={[styles.title, { color: text.primary }, compact && styles.titleCompact]} numberOfLines={1}>
        {event.title}
      </Text>
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
  title: {
    fontSize: 12,
    fontWeight: '500',
  },
  titleCompact: {
    fontSize: 11,
  },
});
