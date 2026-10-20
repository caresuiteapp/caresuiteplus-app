import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PORTAL_LIGHT_LINK_ORANGE, surfaceContrastText, useLightLiquidGlassShell } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { resolveGalaxyTypography } from '@/design/tokens/responsiveTypography';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { PORTAL_MOBILE_CTA_GOLD } from '@/components/portal/assist/MobilePortalKpiCard';

type PortalEmptyStateProps = {
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
  ctaColor?: string;
  ctaSuffix?: string;
  /** Helle Schrift auf dunklem Glas-Hintergrund. */
  onDarkSurface?: boolean;
};

/** Glass-friendly empty state — no white surfaces. */
export function PortalEmptyState({
  title,
  message,
  actionLabel,
  onAction,
  compact = false,
  ctaColor = PORTAL_LIGHT_LINK_ORANGE,
  ctaSuffix = '',
  onDarkSurface = false,
}: PortalEmptyStateProps) {
  const text = surfaceContrastText(onDarkSurface);
  const useLightGlass = useLightLiquidGlassShell();
  const { width } = useDeviceClass();
  const type = resolveGalaxyTypography(width);
  const resolvedCtaColor =
    ctaColor === 'gold'
      ? useLightGlass || !onDarkSurface
        ? PORTAL_LIGHT_LINK_ORANGE
        : PORTAL_MOBILE_CTA_GOLD
      : ctaColor;

  return (
    <View style={[styles.container, compact && styles.compact]}>
      {title ? (
        <Text style={[type.caption, { color: text.muted, fontWeight: '600' }]}>{title}</Text>
      ) : null}
      <Text style={[compact ? type.caption : type.body, { color: text.secondary }]}>{message}</Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} style={styles.cta}>
          <Text style={[type.caption, { color: resolvedCtaColor, fontWeight: '700' }]}>
            {actionLabel}
            {ctaSuffix}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: careSpacing.xs,
    marginTop: careSpacing.xs,
  },
  compact: {
    marginTop: 0,
  },
  cta: {
    alignSelf: 'flex-start',
    marginTop: careSpacing.xs,
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: careSpacing.xs,
  },
});
