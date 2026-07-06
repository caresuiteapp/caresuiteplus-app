import { ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { GlassCard } from '@/design/components/GlassCard';
import { useAuroraAdaptiveText, useLightLiquidGlassShell } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { resolveGalaxyTypography, noBreakTextProps } from '@/design/tokens/responsiveTypography';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { PORTAL_MOBILE_CTA_GOLD } from '@/components/portal/assist/MobilePortalKpiCard';

type PortalGlassHeroProps = {
  eyebrow?: string;
  title: string;
  /** Second title line on phone — e.g. full display name after greeting. */
  titleSecondary?: string;
  subtitle?: string;
  meta?: string;
  badge?: string;
  /** Assist module icon — shown left on phone layout. */
  leadingIcon?: ReactNode;
  /** Show green status dot before meta on phone. */
  showStatusDot?: boolean;
  children?: ReactNode;
  style?: ViewStyle;
};

/** Compact glass header for portal overview sections. */
export function PortalGlassHero({
  eyebrow,
  title,
  titleSecondary,
  subtitle,
  meta,
  badge,
  leadingIcon,
  showStatusDot = false,
  children,
  style,
}: PortalGlassHeroProps) {
  const text = useAuroraAdaptiveText();
  const useLightGlass = useLightLiquidGlassShell();
  const { width, isPhone } = useDeviceClass();
  const type = resolveGalaxyTypography(width);
  const titleStyle = isPhone
    ? { ...type.body, color: text.primary, fontWeight: '700' as const, fontSize: 15, lineHeight: 21 }
    : { ...type.cardTitle, color: text.primary };

  const metaContent = meta ? (
    <View style={styles.metaRow}>
      {showStatusDot ? <View style={styles.statusDot} /> : null}
      <Text
        style={[type.caption, { color: text.muted, flex: 1 }]}
        {...noBreakTextProps}
        numberOfLines={2}
      >
        {meta}
      </Text>
    </View>
  ) : null;

  const heroTextContent = (
    <>
      {badge ? (
        <View style={isPhone ? styles.badgeRow : styles.eyebrowRow}>
          <View style={isPhone ? styles.badgeSpacer : styles.eyebrowSpacer} />
          <View style={styles.badge}>
            <Text
              style={[type.caption, isPhone ? styles.badgeText : undefined, { color: text.primary }]}
            >
              {badge}
            </Text>
          </View>
        </View>
      ) : null}
      <Text style={[titleStyle, { flexShrink: 1 }]} {...noBreakTextProps} numberOfLines={2}>
        {title}
      </Text>
      {titleSecondary ? (
        <Text style={[titleStyle, { flexShrink: 1 }]} {...noBreakTextProps} numberOfLines={2}>
          {titleSecondary}
        </Text>
      ) : null}
      {subtitle ? (
        <Text
          style={[
            isPhone ? type.caption : type.body,
            { color: text.secondary, fontWeight: '600' },
          ]}
          {...noBreakTextProps}
          numberOfLines={2}
        >
          {subtitle}
        </Text>
      ) : null}
      {metaContent}
    </>
  );

  return (
    <GlassCard
      style={[
        isPhone ? styles.compactCard : undefined,
        isPhone && !useLightGlass ? styles.compactCardDark : undefined,
        style,
      ]}
    >
      {isPhone && leadingIcon ? (
        <View style={styles.phoneRow}>
          <View style={styles.leadingIconWrap}>{leadingIcon}</View>
          <View style={styles.phoneContent}>{heroTextContent}</View>
        </View>
      ) : (
        heroTextContent
      )}
      {children}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  compactCard: {
    paddingVertical: careSpacing.sm,
    paddingHorizontal: careSpacing.sm,
    gap: careSpacing.xs,
  },
  compactCardDark: {
    backgroundColor: 'rgba(20,27,40,0.85)',
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: careSpacing.sm,
  },
  eyebrowSpacer: {
    flex: 1,
  },
  eyebrow: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeSpacer: {
    flex: 1,
  },
  badge: {
    paddingHorizontal: careSpacing.sm,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: `${PORTAL_MOBILE_CTA_GOLD}55`,
    backgroundColor: `${PORTAL_MOBILE_CTA_GOLD}18`,
    flexShrink: 0,
  },
  badgeText: {
    fontWeight: '700',
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: careSpacing.sm,
  },
  leadingIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(123,97,255,0.45)',
    backgroundColor: 'rgba(123,97,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  phoneContent: {
    flex: 1,
    gap: careSpacing.xs,
    minWidth: 0,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#22C55E',
    flexShrink: 0,
  },
});
