import { Pressable, StyleSheet, Text, View, type DimensionValue, type ViewStyle } from 'react-native';
import { GlassCard } from '@/design/components/GlassCard';
import { PORTAL_LIGHT_LINK_ORANGE, useAuroraAdaptiveText, useLightLiquidGlassShell } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { resolveGalaxyTypography, noBreakTextProps } from '@/design/tokens/responsiveTypography';
import { useDeviceClass } from '@/hooks/useDeviceClass';

export const PORTAL_MOBILE_CTA_GOLD = '#F5B942';

type MobilePortalKpiCardProps = {
  icon: string;
  label: string;
  value?: number | null;
  emptyMessage: string;
  metricSubtitle?: string;
  ctaLabel?: string;
  accentColor?: string;
  onPress?: () => void;
  onCta?: () => void;
  hidden?: boolean;
};

function neonGlow(accentColor: string): ViewStyle {
  return {
    borderColor: `${accentColor}55`,
    shadowColor: accentColor,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  };
}

/** Two-column mobile KPI tile with neon border and equal height. */
export function MobilePortalKpiCard({
  icon,
  label,
  value,
  emptyMessage,
  metricSubtitle,
  ctaLabel,
  accentColor = '#FF9500',
  onPress,
  onCta,
  hidden = false,
}: MobilePortalKpiCardProps) {
  const text = useAuroraAdaptiveText();
  const useLightGlass = useLightLiquidGlassShell();
  const { width } = useDeviceClass();
  const type = resolveGalaxyTypography(width);
  const hasValue = value !== null && value !== undefined && value > 0;
  const itemWidth = '48%' as DimensionValue;
  const ctaHandler = onCta ?? onPress;

  if (hidden) return null;

  const content = (
    <View style={styles.inner}>
      <View style={[styles.iconBox, { borderColor: `${accentColor}55`, backgroundColor: `${accentColor}18` }]}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <Text style={[type.caption, styles.title, { color: text.primary }]} {...noBreakTextProps}>
        {label}
      </Text>
      <View style={styles.body}>
        {hasValue ? (
          <>
            <Text style={[styles.metric, { color: text.primary }]}>{value}</Text>
            {metricSubtitle ? (
              <Text style={[type.caption, { color: text.secondary }]} {...noBreakTextProps}>
                {metricSubtitle}
              </Text>
            ) : null}
          </>
        ) : (
          <Text style={[type.caption, { color: text.secondary }]} {...noBreakTextProps}>
            {emptyMessage}
          </Text>
        )}
      </View>
      {ctaLabel && ctaHandler ? (
        <Pressable
          onPress={ctaHandler}
          style={styles.cta}
          accessibilityRole="button"
          hitSlop={6}
        >
          <Text
            style={[
              type.caption,
              styles.ctaText,
              useLightGlass ? { color: PORTAL_LIGHT_LINK_ORANGE } : null,
            ]}
            {...noBreakTextProps}
          >
            {ctaLabel}
          </Text>
        </Pressable>
      ) : (
        <View style={styles.ctaSpacer} />
      )}
    </View>
  );

  const card = (
    <GlassCard
      glow={!useLightGlass}
      accentColor={accentColor}
      style={[styles.card, !useLightGlass && styles.cardDark, !useLightGlass && neonGlow(accentColor)]}
    >
      {content}
    </GlassCard>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={[styles.wrapper, { width: itemWidth, flexBasis: itemWidth }]}
        accessibilityRole="button"
      >
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
    minHeight: 148,
    flex: 1,
    padding: careSpacing.sm,
  },
  cardDark: {
    backgroundColor: 'rgba(20,27,40,0.85)',
  },
  inner: {
    flex: 1,
    gap: careSpacing.xs,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 18,
    lineHeight: 22,
  },
  title: {
    fontWeight: '700',
  },
  body: {
    flex: 1,
    gap: 2,
    justifyContent: 'flex-start',
  },
  metric: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 32,
  },
  cta: {
    alignSelf: 'flex-start',
    minHeight: 36,
    justifyContent: 'flex-end',
    paddingVertical: 2,
  },
  ctaSpacer: {
    minHeight: 36,
  },
  ctaText: {
    color: PORTAL_MOBILE_CTA_GOLD,
    fontWeight: '700',
  },
});
