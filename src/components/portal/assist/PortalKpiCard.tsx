import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GlassCard } from '@/design/components/GlassCard';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { resolveGalaxyTypography, noBreakTextProps } from '@/design/tokens/responsiveTypography';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { PortalEmptyState } from './PortalEmptyState';

type PortalKpiCardProps = {
  label: string;
  description?: string;
  value?: number | null;
  emptyMessage: string;
  ctaLabel?: string;
  onPress?: () => void;
  onCta?: () => void;
  hidden?: boolean;
};

/** Glass KPI tile with empty state + optional CTA — never shows fake zeros when hidden. */
export function PortalKpiCard({
  label,
  description,
  value,
  emptyMessage,
  ctaLabel,
  onPress,
  onCta,
  hidden = false,
}: PortalKpiCardProps) {
  if (hidden) return null;

  const text = useAuroraAdaptiveText();
  const { width } = useDeviceClass();
  const type = resolveGalaxyTypography(width);
  const hasValue = value !== null && value !== undefined && value > 0;

  const content = (
    <>
      {description ? (
        <Text style={[type.caption, styles.eyebrow, { color: text.muted }]} {...noBreakTextProps}>
          {description}
        </Text>
      ) : null}
      <Text style={[type.cardTitle, { color: text.primary }]} {...noBreakTextProps}>
        {label}
      </Text>
      {hasValue ? (
        <Text style={[styles.metric, { color: text.primary }]}>{value}</Text>
      ) : (
        <PortalEmptyState
          compact
          message={emptyMessage}
          actionLabel={ctaLabel}
          onAction={onCta}
        />
      )}
    </>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={styles.wrapper}>
        <GlassCard style={styles.card}>{content}</GlassCard>
      </Pressable>
    );
  }

  return (
    <View style={styles.wrapper}>
      <GlassCard style={styles.card}>{content}</GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexGrow: 1,
    flexBasis: '46%',
    minWidth: 150,
  },
  card: {
    minHeight: 130,
    flex: 1,
  },
  eyebrow: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  metric: {
    fontSize: 32,
    fontWeight: '700',
    marginTop: careSpacing.xs,
  },
});
