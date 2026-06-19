import { ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { GlassCard } from '@/design/components/GlassCard';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { resolveGalaxyTypography, noBreakTextProps } from '@/design/tokens/responsiveTypography';
import { useDeviceClass } from '@/hooks/useDeviceClass';

type PortalGlassHeroProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  meta?: string;
  badge?: string;
  /** Assist module icon — shown left on phone layout. */
  leadingIcon?: string;
  children?: ReactNode;
  style?: ViewStyle;
};

/** Compact glass header for portal overview sections. */
export function PortalGlassHero({
  eyebrow,
  title,
  subtitle,
  meta,
  badge,
  leadingIcon,
  children,
  style,
}: PortalGlassHeroProps) {
  const text = useAuroraAdaptiveText();
  const { width, isPhone } = useDeviceClass();
  const type = resolveGalaxyTypography(width);
  const titleStyle = isPhone
    ? [type.body, { color: text.primary, fontWeight: '700', fontSize: 16, lineHeight: 22 }]
    : [type.cardTitle, { color: text.primary }];

  return (
    <GlassCard style={[isPhone && styles.compactCard, style]}>
      {isPhone && leadingIcon ? (
        <View style={styles.phoneRow}>
          <View style={styles.leadingIconWrap}>
            <Text style={styles.leadingIcon}>{leadingIcon}</Text>
          </View>
          <View style={styles.phoneContent}>
            {eyebrow || badge ? (
              <View style={styles.eyebrowRow}>
                {eyebrow ? (
                  <Text
                    style={[type.caption, styles.eyebrow, { color: text.muted, flex: 1 }]}
                    {...noBreakTextProps}
                  >
                    {eyebrow}
                  </Text>
                ) : (
                  <View style={styles.eyebrowSpacer} />
                )}
                {badge ? (
                  <View style={styles.badge}>
                    <Text style={[type.caption, { color: text.primary }]}>{badge}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
            <Text
              style={[titleStyle, { flexShrink: 1 }]}
              {...noBreakTextProps}
              numberOfLines={2}
            >
              {title}
            </Text>
            {meta ? (
              <Text style={[type.caption, { color: text.muted }]} {...noBreakTextProps} numberOfLines={2}>
                {meta}
              </Text>
            ) : null}
          </View>
        </View>
      ) : (
        <>
          {eyebrow || badge ? (
            <View style={styles.eyebrowRow}>
              {eyebrow ? (
                <Text
                  style={[type.caption, styles.eyebrow, { color: text.muted, flex: 1 }]}
                  {...noBreakTextProps}
                >
                  {eyebrow}
                </Text>
              ) : (
                <View style={styles.eyebrowSpacer} />
              )}
              {badge ? (
                <View style={styles.badge}>
                  <Text style={[type.caption, { color: text.primary }]}>{badge}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
          <Text
            style={[titleStyle, { flexShrink: 1 }]}
            {...noBreakTextProps}
            numberOfLines={isPhone ? 2 : 2}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={[type.body, { color: text.secondary, fontWeight: '600' }]}
              {...noBreakTextProps}
              numberOfLines={2}
            >
              {subtitle}
            </Text>
          ) : null}
          {meta ? (
            <Text style={[type.caption, { color: text.muted }]} {...noBreakTextProps} numberOfLines={2}>
              {meta}
            </Text>
          ) : null}
        </>
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
  badge: {
    paddingHorizontal: careSpacing.sm,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,149,0,0.35)',
    backgroundColor: 'rgba(255,149,0,0.12)',
    flexShrink: 0,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: careSpacing.sm,
  },
  leadingIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,149,0,0.35)',
    backgroundColor: 'rgba(255,149,0,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  leadingIcon: {
    fontSize: 22,
  },
  phoneContent: {
    flex: 1,
    gap: careSpacing.xs,
    minWidth: 0,
  },
});
