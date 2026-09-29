import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
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
  compact?: boolean;
};

export function CalendarViewSwitcher({
  viewMode,
  onViewModeChange,
  accentColor = '#62F3FF',
  includeYear = true,
  compact = false,
}: CalendarViewSwitcherProps) {
  const text = useAuroraAdaptiveText();
  const glass = useActiveGlassTokens();
  const activeLabelColor = useInteractiveTextColor(accentColor);
  const baseModes = compact
    ? CALENDAR_VIEW_MODES.filter((mode) => mode.key !== 'list')
    : CALENDAR_VIEW_MODES;
  const modes = includeYear
    ? [...baseModes, { key: 'year' as CalendarViewMode, label: 'Jahr' }]
    : baseModes;

  return (
    <View style={[styles.chips, Platform.OS === 'web' && styles.webChips]}>
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
              Platform.OS === 'web' && styles.webChip,
              Platform.OS === 'web' && active && { backgroundColor: '#DDEEFF', borderColor: accentColor },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.chipLabel, { color: active ? activeLabelColor : text.primary }, Platform.OS === 'web' && styles.webChipLabel]}>
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
  webChip: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAF3FF',
    borderColor: '#B7D0EC',
  },
  webChips: { flexShrink: 1, maxWidth: '100%', alignItems: 'center' },
  webChipLabel: {
    color: '#102B49',
    lineHeight: 20,
    textAlign: 'center',
  },
});
