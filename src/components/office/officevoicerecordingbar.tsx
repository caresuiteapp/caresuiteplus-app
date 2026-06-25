import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumButton } from '@/components/ui';
import { darkGlassSurfaceText, surfaceContrastText, auroraGlass } from '@/design/tokens/auroraGlass';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { spacing, radius } from '@/theme';

type OfficeVoiceRecordingBarProps = {
  durationSeconds: number;
  onStop: () => void;
  onCancel: () => void;
  stopping?: boolean;
  onDarkSurface?: boolean;
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
