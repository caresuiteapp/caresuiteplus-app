import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { CalendarViewMode } from '@/types/modules/calendarEvent';
import { useActiveGlassTokens, useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { useInteractiveTextColor } from '@/design/tokens/carelightadaptive';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';

export const CALENDAR_VIEW_MODES: { key: CalendarViewMode; label: string }[] = [
  { key: 'day', label: 'Tag' },
  { key: 'week', label: 'Woche' },
  { key: 'month', label: 'Monat' },
  { key: 'agenda', label: 'Agenda' },
  { key: 'list', label: 'Liste' },
];

type CalendarViewSwitcherProps = {
  viewMode: CalendarViewMode;
  onViewModeChange: (mode: CalendarViewMode) => void;
  accentColor?: string;
  includeYear?: boolean;
};

export function CalendarViewSwitcher({
  viewMode,
  onViewModeChange,
  accentColor = '#62F3FF',
  includeYear = true,
}: CalendarViewSwitcherProps) {
  const text = useAuroraAdaptiveText();
  const glass = useActiveGlassTokens();
  const activeLabelColor = useInteractiveTextColor(accentColor);
  const modes = includeYear
    ? [...CALENDAR_VIEW_MODES, { key: 'year' as CalendarViewMode, label: 'Jahr' }]
    : CALENDAR_VIEW_MODES;

  return (
    <View style={styles.chips}>
      {modes.map((mode) => {
        const active = viewMode === mode.key;
        return (
          <Pressable
            key={mode.key}
            onPress={() => onViewModeChange(mode.key)}
            style={[
              styles.chip,
              { borderColor: glass.border, backgroundColor: glass.chip },
              active && { backgroundColor: glass.chipActive, borderColor: accentColor },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.chipLabel, { color: active ? activeLabelColor : text.primary }]}>
              {mode.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: careSpacing.xs,
  },
  chip: {
    paddingHorizontal: careSpacing.md,
    paddingVertical: careSpacing.xs,
    borderRadius: careRadius.full,
    borderWidth: 1,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
});
