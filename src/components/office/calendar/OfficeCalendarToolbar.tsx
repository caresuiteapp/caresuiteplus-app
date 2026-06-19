import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { CalendarViewMode } from '@/types/modules/calendarEvent';
import { auroraGlass, useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';
import { CareLightButton } from '@/components/ui';
import { moduleColor } from '@/design/tokens/modules';

const VIEW_MODES: { key: CalendarViewMode; label: string }[] = [
  { key: 'day', label: 'Tag' },
  { key: 'week', label: 'Woche' },
  { key: 'month', label: 'Monat' },
  { key: 'year', label: 'Jahr' },
];

type OfficeCalendarToolbarProps = {
  viewMode: CalendarViewMode;
  onViewModeChange: (mode: CalendarViewMode) => void;
  title: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onOpenSettings: () => void;
};

export function OfficeCalendarToolbar({
  viewMode,
  onViewModeChange,
  title,
  onPrev,
  onNext,
  onToday,
  onOpenSettings,
}: OfficeCalendarToolbarProps) {
  const text = useAuroraAdaptiveText();
  const accent = moduleColor('office');

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.nav}>
          <Pressable onPress={onPrev} style={styles.navBtn} accessibilityLabel="Zurück">
            <Text style={[styles.navLabel, text.primary]}>‹</Text>
          </Pressable>
          <Pressable onPress={onNext} style={styles.navBtn} accessibilityLabel="Weiter">
            <Text style={[styles.navLabel, text.primary]}>›</Text>
          </Pressable>
          <CareLightButton title="Heute" variant="secondary" accentColor={accent} onPress={onToday} />
        </View>
        <Text style={[styles.title, text.primary]}>{title}</Text>
        <CareLightButton
          title="Einstellungen"
          variant="ghost"
          accentColor={accent}
          onPress={onOpenSettings}
        />
      </View>

      <View style={styles.chips}>
        {VIEW_MODES.map((mode) => {
          const active = viewMode === mode.key;
          return (
            <Pressable
              key={mode.key}
              onPress={() => onViewModeChange(mode.key)}
              style={[styles.chip, active && { backgroundColor: auroraGlass.chipActive, borderColor: accent }]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.chipLabel, text.primary, active && { color: accent }]}>{mode.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: careSpacing.sm,
    marginBottom: careSpacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: careSpacing.sm,
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: careSpacing.xs,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: careRadius.md,
    borderWidth: 1,
    borderColor: auroraGlass.border,
    backgroundColor: auroraGlass.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLabel: {
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
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
    borderColor: auroraGlass.border,
    backgroundColor: auroraGlass.chip,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
});
