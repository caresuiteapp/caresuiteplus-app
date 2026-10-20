import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { CalendarEventType } from '@/types/modules/calendarEvent';
import {
  CALENDAR_EVENT_TYPE_COLORS,
  CALENDAR_EVENT_TYPE_LABELS,
} from '@/types/modules/calendarEvent';
import { auroraGlass, useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';

type CalendarFilterBarProps = {
  visibleTypes: Record<CalendarEventType, boolean>;
  onToggleType?: (type: CalendarEventType) => void;
  compact?: boolean;
};

const ALL_TYPES = Object.keys(CALENDAR_EVENT_TYPE_LABELS) as CalendarEventType[];

export function CalendarFilterBar({
  visibleTypes,
  onToggleType,
  compact = false,
}: CalendarFilterBarProps) {
  const text = useAuroraAdaptiveText();

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      {ALL_TYPES.map((type) => {
        const active = visibleTypes[type] !== false;
        const chip = (
          <View
            style={[
              styles.chip,
              active ? styles.chipActive : styles.chipInactive,
              compact && styles.chipCompact,
            ]}
          >
            <View style={[styles.dot, { backgroundColor: CALENDAR_EVENT_TYPE_COLORS[type] }]} />
            <Text style={[styles.label, { color: text.secondary }, !active && styles.labelInactive]}>
              {CALENDAR_EVENT_TYPE_LABELS[type]}
            </Text>
          </View>
        );

        if (!onToggleType) return <View key={type}>{chip}</View>;

        return (
          <Pressable key={type} onPress={() => onToggleType(type)} accessibilityRole="button">
            {chip}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: careSpacing.xs,
  },
  wrapCompact: { gap: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: careSpacing.sm,
    paddingVertical: 4,
    borderRadius: careRadius.full,
    borderWidth: 1,
    borderColor: auroraGlass.border,
    backgroundColor: auroraGlass.chip,
  },
  chipCompact: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  chipActive: { backgroundColor: auroraGlass.chip },
  chipInactive: { opacity: 0.45 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontSize: 12 },
  labelInactive: { textDecorationLine: 'line-through' },
});
