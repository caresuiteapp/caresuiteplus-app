import type { ReactNode } from 'react';
import { Platform, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { GlassCard } from '@/design/components/GlassCard';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { portalPremium } from '@/design/tokens/portalPremium';
import { careSpacing } from '@/design/tokens/spacing';
import { resolveGalaxyTypography } from '@/design/tokens/responsiveTypography';
import { useDeviceClass } from '@/hooks/useDeviceClass';

type PortalGlassHeroProps = {
  eyebrow?: string;
  title: string;
  titleSecondary?: string;
  subtitle?: string;
  meta?: string;
  badge?: string;
  leadingIcon?: ReactNode;
  showStatusDot?: boolean;
  children?: ReactNode;
  style?: ViewStyle;
};

const breakLongWords = Platform.OS === 'web'
  ? ({ overflowWrap: 'anywhere', wordBreak: 'break-word' } as unknown as TextStyle)
  : null;

/** Premium header used by portal sections and detail content on every form factor. */
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
  const { width, isPhone } = useDeviceClass();
  const compact = isPhone || width < 760;
  const type = resolveGalaxyTypography(width);

  return (
    <GlassCard style={[styles.card, compact && styles.cardCompact, style]}>
      <View style={[styles.header, compact && styles.headerCompact]}>
        {leadingIcon ? (
          <View style={[styles.leadingIcon, compact && styles.leadingIconCompact]}>{leadingIcon}</View>
        ) : (
          <View style={[styles.leadingIcon, compact && styles.leadingIconCompact]}>
            <Ionicons name="sparkles-outline" color={portalPremium.accent.blue} size={compact ? 19 : 23} />
          </View>
        )}
        <View style={styles.copy}>
          {eyebrow || badge ? (
            <View style={styles.topline}>
              {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
              {badge ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{badge}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
          <Text style={[compact ? type.bodyStrong : type.cardTitle, styles.title, breakLongWords]}>{title}</Text>
          {titleSecondary ? (
            <Text style={[compact ? type.bodyStrong : type.cardTitle, styles.title, breakLongWords]}>{titleSecondary}</Text>
          ) : null}
          {subtitle ? <Text style={[type.body, styles.subtitle, breakLongWords]}>{subtitle}</Text> : null}
          {meta ? (
            <View style={styles.metaRow}>
              {showStatusDot ? <View style={styles.statusDot} /> : null}
              <Text style={[type.caption, { color: text.muted, flex: 1 }, breakLongWords]}>{meta}</Text>
            </View>
          ) : null}
        </View>
      </View>
      {children ? <View style={styles.children}>{children}</View> : null}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 132,
    padding: careSpacing.lg,
    borderColor: portalPremium.border,
  },
  cardCompact: {
    minHeight: 0,
    padding: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  headerCompact: {
    alignItems: 'flex-start',
    gap: 10,
  },
  leadingIcon: {
    width: 52,
    height: 52,
    flexShrink: 0,
    borderWidth: 1,
    borderColor: portalPremium.borderStrong,
    borderRadius: 16,
    backgroundColor: 'rgba(5,108,232,0.09)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leadingIconCompact: {
    width: 42,
    height: 42,
    borderRadius: 13,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  topline: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  eyebrow: {
    color: portalPremium.accent.blueDark,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '900',
    letterSpacing: 0.85,
    textTransform: 'uppercase',
  },
  title: {
    color: portalPremium.text.primary,
    fontWeight: '900',
  },
  subtitle: {
    color: portalPremium.text.secondary,
    fontWeight: '600',
  },
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: portalPremium.borderSoft,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.78)',
  },
  badgeText: {
    color: portalPremium.accent.blueDark,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    flexShrink: 0,
    borderRadius: 999,
    backgroundColor: portalPremium.accent.success,
  },
  children: {
    marginTop: careSpacing.sm,
    gap: careSpacing.sm,
  },
});
