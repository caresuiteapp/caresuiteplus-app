import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CareSuiteIcon } from '@/components/brand/CareSuiteIcon';
import { authBackLinkColor, useAuthFlowTypography } from '@/design/tokens/authTypography';
import { galaxyPalette } from '@/design/tokens/galaxy';
import { useAuroraGlassActive } from '@/design/tokens/auroraGlass';
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
  const type = useAuthFlowTypography();
  const { isPhone } = useDeviceClass();
  const iconSize = isPhone ? 72 : 48;

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
        <CareSuiteIcon emoji={iconEmoji} accentColor={accentColor} size={iconSize} />
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
  const type = useAuthFlowTypography();
  const auroraActive = useAuroraGlassActive();

  return (
    <View style={styles.header}>
      {showBack && onBack ? (
        <Pressable onPress={onBack} style={styles.backBtn} accessibilityRole="button">
          <Text style={[styles.backText, { color: authBackLinkColor(auroraActive) }]}>← Zurück</Text>
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
    fontSize: 14,
    fontWeight: '600',
  },
});
