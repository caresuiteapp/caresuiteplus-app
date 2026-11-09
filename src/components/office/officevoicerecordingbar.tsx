import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumButton } from '@/components/ui';
import { darkGlassSurfaceText, surfaceContrastText, auroraGlass } from '@/design/tokens/auroraGlass';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { withCareSuiteTypography } from '@/design/withCareSuiteTypography';
import { webScaledFontMetric as font } from '@/design/web/webFontSize';
import { EmployeePortalAgendaAction } from '@/components/portal/employee/EmployeePortalAgendaAction';
import { employeePortalDesign as employeeInk } from '@/components/portal/employee/employeePortalDesign';
import { spacing, radius } from '@/theme';

type OfficeVoiceRecordingBarProps = {
  durationSeconds: number;
  onStop: () => void;
  onCancel: () => void;
  stopping?: boolean;
  onDarkSurface?: boolean;
  appearance?: 'employee';
};

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function OfficeVoiceRecordingBar({
  durationSeconds,
  onStop,
  onCancel,
  stopping = false,
  onDarkSurface = false,
  appearance,
}: OfficeVoiceRecordingBarProps) {
  const { c } = useCareLightPalette();
  const { typography } = useLegacyTheme();
  const ink = onDarkSurface ? darkGlassSurfaceText : surfaceContrastText(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          padding: spacing.sm,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: onDarkSurface ? auroraGlass.border : c.violet,
          backgroundColor: onDarkSurface ? auroraGlass.chip : `${c.violet}12`,
        },
        pulse: {
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: '#e74c3c',
        },
        label: { ...typography.caption, color: ink.primary, flex: 1, fontWeight: '600' },
        timer: {
          ...typography.caption,
          color: onDarkSurface ? darkGlassSurfaceText.secondary : c.violet,
          fontWeight: '700',
          minWidth: 44,
        },
      }),
    [c, ink, onDarkSurface, typography],
  );

  if (appearance === 'employee') {
    const duration = formatDuration(durationSeconds);
    return (
      <View style={employeeStyles.recording}>
        <View style={employeeStyles.recordingInfo} accessibilityRole="alert">
          <View style={employeeStyles.dot} accessibilityElementsHidden />
          <Text style={employeeStyles.label}>Aufnahme läuft</Text>
          <Text style={employeeStyles.timer} accessibilityLabel={`Dauer ${duration}`}>{duration}</Text>
        </View>
        <View style={employeeStyles.recordingActions}>
          <EmployeePortalAgendaAction label="Stoppen" icon="stop-outline" primary busy={stopping}
            onPress={onStop} accessibilityLabel="Aufnahme stoppen und als Anhang hinzufügen" />
          <EmployeePortalAgendaAction label="Abbrechen" icon="close-outline" disabled={stopping}
            onPress={onCancel} accessibilityLabel="Aufnahme abbrechen" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap} accessibilityRole="alert" accessibilityLabel="Sprachaufnahme läuft">
      <View style={styles.pulse} accessibilityElementsHidden />
      <Text style={styles.label}>Aufnahme…</Text>
      <Text style={styles.timer} accessibilityLabel={`Dauer ${formatDuration(durationSeconds)}`}>
        {formatDuration(durationSeconds)}
      </Text>
      <PremiumButton
        title="Stoppen"
        size="sm"
        variant="primary"
        onPress={onStop}
        loading={stopping}
        accessibilityLabel="Aufnahme stoppen und als Anhang hinzufügen"
      />
      <PremiumButton
        title="Abbrechen"
        size="sm"
        variant="ghost"
        onPress={onCancel}
        disabled={stopping}
        onDarkSurface={onDarkSurface}
        accessibilityLabel="Aufnahme abbrechen"
      />
    </View>
  );
}

const employeeStyles = StyleSheet.create(withCareSuiteTypography({
  recording: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
    gap: 8, padding: 8, borderRadius: 12, borderWidth: 1, borderColor: employeeInk.line,
    backgroundColor: employeeInk.control,
  },
  recordingInfo: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  recordingActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF8E9A' },
  label: { color: employeeInk.text, fontSize: font(14), lineHeight: font(20), fontWeight: '700' },
  timer: { color: employeeInk.muted, fontSize: font(14), lineHeight: font(20), fontVariant: ['tabular-nums'] },
}));
