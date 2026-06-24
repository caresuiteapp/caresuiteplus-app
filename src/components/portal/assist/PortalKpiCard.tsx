import { Pressable, StyleSheet, Text, View, type DimensionValue } from 'react-native';
import { GlassCard } from '@/design/components/GlassCard';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { breakpoints, kpiColumnsForDeviceClass } from '@/design/tokens/breakpoints';
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

function resolveKpiColumnCount(width: number, deviceClass: ReturnType<typeof useDeviceClass>['deviceClass']) {
  if (width < breakpoints.largePhone) return 1;
  if (deviceClass === 'phone') return 2;
  return kpiColumnsForDeviceClass(deviceClass);
}

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
  const text = useAuroraAdaptiveText();
  const { width, deviceClass, isPhone } = useDeviceClass();
  const type = resolveGalaxyTypography(width);
  const hasValue = value !== null && value !== undefined && value > 0;
  const columnCount = resolveKpiColumnCount(width, deviceClass);
  const itemWidth = `${Math.floor(100 / columnCount) - 1}%` as DimensionValue;

  if (hidden) return null;
  const wrapperStyle = [
    styles.wrapper,
    {
      width: itemWidth,
      flexBasis: itemWidth,
      minWidth: isPhone ? 0 : 150,
    },
  ];

  const content = (
    <>
      {description ? (
        <Text style={[type.caption, styles.eyebrow, { color: text.secondary }]} {...noBreakTextProps}>
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
      <Pressable onPress={onPress} style={wrapperStyle} accessibilityRole="button">
        <GlassCard style={styles.card}>{content}</GlassCard>
      </Pressable>
    );
  }

  return (
    <View style={wrapperStyle}>
      <GlassCard style={styles.card}>{content}</GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexGrow: 1,
    overflow: 'hidden',
  },
  card: {
    minHeight: 120,
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
