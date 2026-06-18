import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumButton } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { spacing, radius } from '@/theme';

type OfficeVoiceRecordingBarProps = {
  durationSeconds: number;
  onStop: () => void;
  onCancel: () => void;
  stopping?: boolean;
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
}: OfficeVoiceRecordingBarProps) {
  const { c } = useCareLightPalette();
  const { typography } = useLegacyTheme();

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
          borderColor: c.violet,
          backgroundColor: `${c.violet}12`,
        },
        pulse: {
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: '#e74c3c',
        },
        label: { ...typography.caption, color: c.text, flex: 1, fontWeight: '600' },
        timer: { ...typography.caption, color: c.violet, fontWeight: '700', minWidth: 44 },
      }),
    [c, typography],
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
        accessibilityLabel="Aufnahme abbrechen"
      />
    </View>
  );
}
