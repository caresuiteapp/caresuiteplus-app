import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { usePremiumHeroTextStyles } from '@/design/tokens/carelightadaptive';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumListHeroFrame } from '@/components/ui';

import { designTokens, spacing } from '@/theme';

type AuthLoginHeroProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  icon?: string;
  portalLabel: string;
  portalVariant?: 'orange' | 'cyan' | 'green' | 'muted' | 'red';
  hint?: string;
};

export function AuthLoginHero({
  eyebrow,
  title,
  subtitle,
  icon = '🔐',
  portalLabel,
  portalVariant = 'orange',
  hint,
}: AuthLoginHeroProps) {
  const { colors, typography } = useLegacyTheme();
  const heroText = usePremiumHeroTextStyles();
  const styles = useMemo(
    () =>
      StyleSheet.create({
  topRow: { flexDirection: 'row', gap: spacing.md },
  textCol: { flex: 1, gap: 2 },
  eyebrow: heroText.eyebrow,
  title: heroText.title,
  meta: heroText.meta,
  iconBadge: {
    width: iconSize,
    height: iconSize,
    borderRadius: iconSize / 2,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(98,243,255,0.35)',
  },
  iconText: { fontSize: 22 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  hint: { ...typography.caption, color: 'rgba(255,255,255,0.75)' },
}),
    [heroText.eyebrow, heroText.title, heroText.meta, colors.bgElevated, typography.caption],
  );


  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.meta}>{subtitle}</Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>{icon}</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label={portalLabel} variant={portalVariant} dot />
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;
