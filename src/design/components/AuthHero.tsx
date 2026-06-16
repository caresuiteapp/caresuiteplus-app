import { ReactNode, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CareSuiteIcon } from '@/components/brand/CareSuiteIcon';
import { galaxyPalette } from '@/design/tokens/galaxy';
import { resolveGalaxyTypography } from '@/design/tokens/responsiveTypography';
import { careSpacing } from '@/design/tokens/spacing';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { GlassCard } from './GlassCard';
import { StatusBadge, type StatusKind } from './StatusBadge';

type AuthHeroProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  iconEmoji?: string;
  accentColor?: string;
  badges?: { kind: StatusKind; label?: string }[];
  footer?: ReactNode;
};

/** Premium auth / landing hero block with glass panel and safe typography. */
export function AuthHero({
  eyebrow,
  title,
  subtitle,
  iconEmoji = '🔐',
  accentColor = galaxyPalette.careOrange,
  badges = [],
  footer,
}: AuthHeroProps) {
  const { width } = useDeviceClass();
  const type = useMemo(() => resolveGalaxyTypography(width), [width]);

  return (
    <GlassCard glow style={styles.hero}>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={type.eyebrow} numberOfLines={1}>
            {eyebrow}
          </Text>
          <Text style={type.h2} numberOfLines={2}>
            {title}
          </Text>
          <Text style={[type.body, styles.subtitle]} numberOfLines={4}>
            {subtitle}
          </Text>
        </View>
        <CareSuiteIcon emoji={iconEmoji} accentColor={accentColor} size={48} />
      </View>
      {badges.length > 0 ? (
        <View style={styles.badges}>
          {badges.map((b) => (
            <StatusBadge key={`${b.kind}-${b.label ?? ''}`} kind={b.kind} label={b.label} dot />
          ))}
        </View>
      ) : null}
      {footer}
    </GlassCard>
  );
}

type AuthScreenHeaderProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  showBack?: boolean;
};

export function AuthScreenHeader({
  title,
  subtitle,
  onBack,
  showBack = true,
}: AuthScreenHeaderProps) {
  const { width } = useDeviceClass();
  const type = useMemo(() => resolveGalaxyTypography(width), [width]);

  return (
    <View style={styles.header}>
      {showBack && onBack ? (
        <Pressable onPress={onBack} style={styles.backBtn} accessibilityRole="button">
          <Text style={styles.backText}>← Zurück</Text>
        </Pressable>
      ) : null}
      <Text style={type.h1} numberOfLines={2}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={[type.body, styles.headerSub]} numberOfLines={3}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginBottom: careSpacing.xs,
  },
  topRow: {
    flexDirection: 'row',
    gap: careSpacing.md,
    alignItems: 'flex-start',
    minWidth: 0,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    gap: careSpacing.xs,
  },
  subtitle: {
    flexShrink: 1,
    minWidth: 0,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: careSpacing.sm,
    marginTop: careSpacing.md,
  },
  header: {
    gap: careSpacing.xs,
    marginBottom: careSpacing.sm,
    minWidth: 0,
  },
  headerSub: {
    flexShrink: 1,
  },
  backBtn: {
    alignSelf: 'flex-start',
    marginBottom: careSpacing.xs,
    paddingVertical: careSpacing.xs,
  },
  backText: {
    color: galaxyPalette.galaxyCyan,
    fontSize: 14,
    fontWeight: '600',
  },
});
