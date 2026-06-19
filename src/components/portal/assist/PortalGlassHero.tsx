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
  children,
  style,
}: PortalGlassHeroProps) {
  const text = useAuroraAdaptiveText();
  const { width } = useDeviceClass();
  const type = resolveGalaxyTypography(width);

  return (
    <GlassCard style={style}>
      {eyebrow ? (
        <Text style={[type.caption, styles.eyebrow, { color: text.muted }]} {...noBreakTextProps}>
          {eyebrow}
        </Text>
      ) : null}
      <View style={styles.titleRow}>
        <Text style={[type.cardTitle, { color: text.primary, flex: 1 }]} {...noBreakTextProps}>
          {title}
        </Text>
        {badge ? (
          <View style={styles.badge}>
            <Text style={[type.caption, { color: text.primary }]}>{badge}</Text>
          </View>
        ) : null}
      </View>
      {subtitle ? (
        <Text style={[type.body, { color: text.secondary, fontWeight: '600' }]} {...noBreakTextProps}>
          {subtitle}
        </Text>
      ) : null}
      {meta ? (
        <Text style={[type.caption, { color: text.muted }]} {...noBreakTextProps}>
          {meta}
        </Text>
      ) : null}
      {children}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: careSpacing.sm,
  },
  badge: {
    paddingHorizontal: careSpacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,149,0,0.35)',
    backgroundColor: 'rgba(255,149,0,0.12)',
  },
});
