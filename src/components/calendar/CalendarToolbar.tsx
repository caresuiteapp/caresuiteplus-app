import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { CalendarViewMode } from '@/types/modules/calendarEvent';
import { useActiveGlassTokens, useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';
import { PremiumButton } from '@/components/ui';
import { CalendarViewSwitcher } from './CalendarViewSwitcher';

type CalendarToolbarProps = {
  viewMode: CalendarViewMode;
  onViewModeChange: (mode: CalendarViewMode) => void;
  title: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onOpenSettings?: () => void;
  accentColor?: string;
  includeYear?: boolean;
};

export function CalendarToolbar({
  viewMode,
  onViewModeChange,
  title,
  onPrev,
  onNext,
  onToday,
  onOpenSettings,
  accentColor = '#62F3FF',
  includeYear = true,
}: CalendarToolbarProps) {
  const text = useAuroraAdaptiveText();
  const glass = useActiveGlassTokens();

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.nav}>
          <Pressable
            onPress={onPrev}
            style={[styles.navBtn, { borderColor: glass.border, backgroundColor: glass.chip }]}
            accessibilityLabel="Zurück"
          >
            <Text style={[styles.navLabel, { color: text.primary }]}>‹</Text>
          </Pressable>
          <Pressable
            onPress={onNext}
            style={[styles.navBtn, { borderColor: glass.border, backgroundColor: glass.chip }]}
            accessibilityLabel="Weiter"
          >
            <Text style={[styles.navLabel, { color: text.primary }]}>›</Text>
          </Pressable>
          <PremiumButton title="Heute" variant="secondary" onPress={onToday} />
        </View>
        <Text style={[styles.title, { color: text.primary }]} numberOfLines={2}>
          {title}
        </Text>
        {onOpenSettings ? (
          <PremiumButton title="Einstellungen" variant="ghost" onPress={onOpenSettings} />
        ) : (
          <View style={styles.navBtnPlaceholder} />
        )}
      </View>

      <CalendarViewSwitcher
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        accentColor={accentColor}
        includeYear={includeYear}
      />
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnPlaceholder: { width: 36 },
  navLabel: {
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    textAlign: 'center',
  },
});
