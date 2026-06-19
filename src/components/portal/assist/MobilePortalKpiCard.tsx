import { Pressable, StyleSheet, Text, View, type DimensionValue } from 'react-native';
import { GlassCard } from '@/design/components/GlassCard';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { resolveGalaxyTypography, noBreakTextProps } from '@/design/tokens/responsiveTypography';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { PortalEmptyState } from './PortalEmptyState';

type MobilePortalKpiCardProps = {
  icon: string;
  label: string;
  description?: string;
  value?: number | null;
  emptyMessage: string;
  ctaLabel?: string;
  accentColor?: string;
  onPress?: () => void;
  onCta?: () => void;
  hidden?: boolean;
};

/** Two-column mobile KPI tile with neon border and equal height. */
export function MobilePortalKpiCard({
  icon,
  label,
  description,
  value,
  emptyMessage,
  ctaLabel,
  accentColor = '#FF9500',
  onPress,
  onCta,
  hidden = false,
}: MobilePortalKpiCardProps) {
  const text = useAuroraAdaptiveText();
  const { width } = useDeviceClass();
  const type = resolveGalaxyTypography(width);
  const hasValue = value !== null && value !== undefined && value > 0;
  const itemWidth = '48%' as DimensionValue;

  if (hidden) return null;

  const content = (
    <>
      <View style={styles.header}>
        <Text style={styles.icon}>{icon}</Text>
        <View style={styles.headerText}>
          {description ? (
            <Text style={[type.caption, styles.eyebrow, { color: text.muted }]} {...noBreakTextProps}>
              {description}
            </Text>
          ) : null}
          <Text style={[type.caption, { color: text.primary, fontWeight: '700' }]} {...noBreakTextProps}>
            {label}
          </Text>
        </View>
      </View>
      {hasValue ? (
        <Text style={[styles.metric, { color: text.primary }]}>{value}</Text>
      ) : (
        <PortalEmptyState compact message={emptyMessage} actionLabel={ctaLabel} onAction={onCta} />
      )}
    </>
  );

  const card = (
    <GlassCard glow accentColor={accentColor} style={styles.card}>
      {content}
    </GlassCard>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={[styles.wrapper, { width: itemWidth, flexBasis: itemWidth }]} accessibilityRole="button">
        {card}
      </Pressable>
    );
  }

  return (
    <View style={[styles.wrapper, { width: itemWidth, flexBasis: itemWidth }]}>
      {card}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexGrow: 1,
    minWidth: 0,
  },
  card: {
    minHeight: 132,
    flex: 1,
    padding: careSpacing.md,
    gap: careSpacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: careSpacing.xs,
  },
  icon: {
    fontSize: 20,
    lineHeight: 24,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metric: {
    fontSize: 28,
    fontWeight: '700',
    marginTop: careSpacing.xs,
  },
});
