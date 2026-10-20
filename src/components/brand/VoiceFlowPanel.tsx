import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumButton, PremiumCard } from '@/components/ui';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { spacing } from '@/theme';
import { CareSuiteIcon } from './CareSuiteIcon';

type VoiceFlowPanelProps = {
  onStart?: () => void;
  compact?: boolean;
};

export function VoiceFlowPanel({ onStart, compact = false }: VoiceFlowPanelProps) {
  const { colors, typography } = useLegacyTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        compact: {
          maxWidth: 420,
        },
        row: {
          flexDirection: 'row',
          gap: spacing.md,
          marginBottom: spacing.sm,
        },
        text: {
          flex: 1,
          gap: spacing.xs,
        },
        title: {
          ...typography.bodyStrong,
        },
        body: {
          ...typography.caption,
          color: colors.textSecondary,
        },
      }),
    [colors.textSecondary, typography.bodyStrong, typography.caption],
  );

  return (
    <PremiumCard accentColor={colors.orange} style={compact ? styles.compact : undefined}>
      <View style={styles.row}>
        <CareSuiteIcon emoji="🎙️" accentColor={colors.orange} />
        <View style={styles.text}>
          <Text style={styles.title}>VoiceFlow</Text>
          <Text style={styles.body} numberOfLines={2}>
            Geführte Spracheingabe für mobile Dokumentation — Hände frei, Schritt für Schritt.
          </Text>
        </View>
      </View>
      {onStart ? (
        <PremiumButton title="VoiceFlow starten" variant="secondary" onPress={onStart} />
      ) : null}
    </PremiumCard>
  );
}
