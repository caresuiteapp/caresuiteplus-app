import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumButton, PremiumCard } from '@/components/ui';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { spacing } from '@/theme';
import { CareSuiteIcon } from './CareSuiteIcon';

type PlanPilotPanelProps = {
  onOpen?: () => void;
  compact?: boolean;
};

export function PlanPilotPanel({ onOpen, compact = false }: PlanPilotPanelProps) {
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
    <PremiumCard accentColor={colors.violet} style={compact ? styles.compact : undefined}>
      <View style={styles.row}>
        <CareSuiteIcon emoji="🧭" accentColor={colors.violet} />
        <View style={styles.text}>
          <Text style={styles.title}>PlanPilot</Text>
          <Text style={styles.body} numberOfLines={2}>
            Planungsassistent für Einsätze, Touren und Kapazität — Übersicht auf Tablet und Desktop.
          </Text>
        </View>
      </View>
      {onOpen ? (
        <PremiumButton title="PlanPilot öffnen" variant="ghost" onPress={onOpen} />
      ) : null}
    </PremiumCard>
  );
}
