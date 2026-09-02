import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { CalendarViewMode } from '@/types/modules/calendarEvent';
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
  compact?: boolean;
};

function ToolbarButton({
  label,
  onPress,
  accessibilityLabel,
  primary = false,
}: {
  label: string;
  onPress: () => void;
  accessibilityLabel: string;
  primary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.control,
        primary && styles.controlPrimary,
        pressed && styles.controlPressed,
      ]}
    >
      <Text style={[styles.controlText, primary && styles.controlPrimaryText]}>{label}</Text>
    </Pressable>
  );
}

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
  compact: compactOverride,
}: CalendarToolbarProps) {
  const { width } = useWindowDimensions();
  const compact = compactOverride ?? width < 980;

  return (
    <View style={[styles.shell, compact && styles.shellCompact]}>
      <View style={[styles.topRow, compact && styles.topRowCompact]}>
        <View style={styles.navigationBlock}>
          <View style={styles.navButtons}>
            <ToolbarButton label="‹" onPress={onPrev} accessibilityLabel="Vorheriger Zeitraum" />
            <ToolbarButton label="›" onPress={onNext} accessibilityLabel="Nächster Zeitraum" />
            <ToolbarButton label="Heute" onPress={onToday} accessibilityLabel="Zum heutigen Tag" primary />
          </View>
          {!compact ? <Text style={styles.navigationHint}>Zeitraum navigieren</Text> : null}
        </View>

        <View style={[styles.periodBlock, compact && styles.periodBlockCompact]}>
          {!compact ? <Text style={styles.periodEyebrow}>AKTUELLER ZEITRAUM</Text> : null}
          <Text style={[styles.periodTitle, compact && styles.periodTitleCompact]} numberOfLines={2}>{title}</Text>
        </View>

        {onOpenSettings ? (
          <Pressable
            onPress={onOpenSettings}
            accessibilityRole="button"
            accessibilityLabel="Kalendereinstellungen öffnen"
            style={({ pressed }) => [styles.settingsButton, pressed && styles.controlPressed]}
          >
            <View style={styles.settingsIcon}><Text style={styles.settingsIconText}>⚙</Text></View>
            <View>
              <Text style={styles.settingsLabel}>Einstellungen</Text>
              <Text style={styles.settingsHint}>Ansicht & Filter</Text>
            </View>
          </Pressable>
        ) : compact ? null : <View style={styles.settingsPlaceholder} />}
      </View>

      <View style={styles.switcherRow}>
        {!compact ? <Text style={styles.switcherLabel}>ANSICHT</Text> : null}
        <CalendarViewSwitcher
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
          accentColor={accentColor}
          includeYear={includeYear}
          compact={compact}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(113,211,255,0.34)',
    backgroundColor: 'rgba(3,20,43,0.92)',
    padding: 18,
    gap: 16,
    marginBottom: 14,
    shadowColor: '#36C9FF',
    shadowOpacity: 0.2,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 14 },
  },
  shellCompact: {
    borderRadius: 18,
    padding: 12,
    gap: 12,
    marginBottom: 0,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 18,
  },
  topRowCompact: { flexWrap: 'wrap' },
  navigationBlock: { gap: 5 },
  navButtons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navigationHint: { color: '#8EABC4', fontSize: 11, fontWeight: '700' },
  control: {
    minWidth: 44,
    height: 44,
    paddingHorizontal: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(139,220,255,0.35)',
    backgroundColor: 'rgba(11,38,70,0.86)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlPrimary: {
    minWidth: 92,
    borderColor: '#87E8FF',
    backgroundColor: '#0D79DE',
  },
  controlPressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  controlText: { color: '#EAF8FF', fontSize: 21, lineHeight: 23, fontWeight: '900' },
  controlPrimaryText: { color: '#FFFFFF', fontSize: 14, lineHeight: 18 },
  periodBlock: { flex: 1, minWidth: 240, alignItems: 'center' },
  periodBlockCompact: { minWidth: 130, alignItems: 'flex-start' },
  periodEyebrow: {
    color: '#74DCFF',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '900',
    letterSpacing: 1.8,
  },
  periodTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(45,202,255,0.45)',
    textShadowRadius: 14,
    textAlign: 'center',
  },
  periodTitleCompact: {
    fontSize: 18,
    lineHeight: 22,
    textAlign: 'left',
  },
  settingsButton: {
    minWidth: 176,
    minHeight: 52,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(133,223,255,0.42)',
    backgroundColor: 'rgba(10,51,87,0.78)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  settingsIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(98,243,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIconText: { color: '#8BE8FF', fontSize: 18 },
  settingsLabel: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  settingsHint: { color: '#9AB6CC', fontSize: 10, marginTop: 2 },
  settingsPlaceholder: { width: 176 },
  switcherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: 'rgba(118,204,255,0.16)',
  },
  switcherLabel: { color: '#79DFFF', fontSize: 10, fontWeight: '900', letterSpacing: 1.6 },
});
