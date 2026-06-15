import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import { isDemoMode } from '@/lib/supabase/config';
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
  const { colors, typography, gradients, mode } = useLegacyTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
  topRow: { flexDirection: 'row', gap: spacing.md },
  textCol: { flex: 1, gap: 2 },
  eyebrow: {
    ...typography.caption,
    color: colors.cyan,
    letterSpacing: designTokens.hero.eyebrowLetterSpacing,
  },
  title: { ...typography.h2 },
  meta: { ...typography.caption, color: colors.textMuted },
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
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiItem: { flex: 1, minWidth: 100 },
  hint: { ...typography.caption, color: colors.textMuted },
}),
    [colors, typography, gradients],
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
        {isDemoMode() ? <PremiumBadge label="Demo-Modus" variant="cyan" /> : null}
        <PremiumBadge label="preparedOnly Auth" variant="muted" />
      </View>
      <View style={styles.kpiRow}>
        <PremiumKpiCard label="Zugang" value="Mandant" subValue="Demo / Pilot" icon="🏢" accentColor={colors.orange} style={styles.kpiItem} />
        <PremiumKpiCard label="Sicherheit" value="RLS" subValue="Supabase Auth" icon="🛡️" accentColor={colors.cyan} style={styles.kpiItem} />
        <PremiumKpiCard label="Status" value="Prototyp" subValue="Kein Store-Release" icon="📋" accentColor={colors.violet} style={styles.kpiItem} />
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;

