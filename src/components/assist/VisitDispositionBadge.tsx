import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { useMemo } from 'react';
import { PremiumBadge } from '@/components/ui';
import { auroraGlass } from '@/design/tokens/auroraGlass';
import { neonGlow } from '@/design/tokens/motion';
import { spacing } from '@/theme';

type VisitDispositionBadgeProps = {
  label: string;
  variant?: 'green' | 'orange' | 'red' | 'cyan' | 'muted' | 'purple';
  compact?: boolean;
};

const VARIANT_GLOW: Record<NonNullable<VisitDispositionBadgeProps['variant']>, string> = {
  green: '#4ADE80',
  orange: '#FF9500',
  red: '#FF6B6B',
  cyan: '#62F3FF',
  muted: '#94A3B8',
  purple: '#C084FC',
};

export function VisitDispositionBadge({
  label,
  variant = 'muted',
  compact = false,
}: VisitDispositionBadgeProps) {
  const glowColor = VARIANT_GLOW[variant];
  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          borderRadius: 999,
          backgroundColor: auroraGlass.chip,
          borderWidth: 1,
          borderColor: `${glowColor}44`,
          ...(Platform.OS === 'web'
            ? (neonGlow(glowColor, 0.35, 12, 4) as ViewStyle)
            : null),
        },
        compact: { transform: [{ scale: 0.92 }] },
      }),
    [glowColor],
  );

  return (
    <View style={[styles.wrap, compact ? styles.compact : null]}>
      <PremiumBadge label={label} variant={variant} dot />
    </View>
  );
}

type VisitDispositionBadgeRowProps = {
  planningLabel: string;
  proofLabel: string;
  budgetLabel: string;
  isAtRisk?: boolean;
  isIncomplete?: boolean;
};

export function VisitDispositionBadgeRow({
  planningLabel,
  proofLabel,
  budgetLabel,
  isAtRisk,
  isIncomplete,
}: VisitDispositionBadgeRowProps) {
  return (
    <View style={badgeRowStyles.row}>
      <VisitDispositionBadge label={planningLabel} variant="cyan" compact />
      <VisitDispositionBadge label={proofLabel} variant="purple" compact />
      <VisitDispositionBadge label={budgetLabel} variant="orange" compact />
      {isAtRisk ? <VisitDispositionBadge label="Gefährdet" variant="red" compact /> : null}
      {isIncomplete ? <VisitDispositionBadge label="Unvollständig" variant="orange" compact /> : null}
    </View>
  );
}

const badgeRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
});
