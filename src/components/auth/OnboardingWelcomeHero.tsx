import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import { designTokens, spacing } from '@/theme';

type OnboardingWelcomeHeroProps = {
  step: number;
  totalSteps: number;
};

export function OnboardingWelcomeHero({ step, totalSteps }: OnboardingWelcomeHeroProps) {
  const { colors, typography, gradients, mode } = useLegacyTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
  topRow: { flexDirection: 'row', gap: spacing.md },
  textCol: { flex: 1, gap: 2 },
  eyebrow: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: designTokens.hero.eyebrowLetterSpacing,
  },
  title: { ...typography.h2, color: '#FFFFFF', fontWeight: '800' },
  meta: { ...typography.caption, color: 'rgba(255,255,255,0.75)' },
  iconBadge: {
    width: iconSize,
    height: iconSize,
    borderRadius: iconSize / 2,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,176,32,0.35)',
  },
  iconText: { fontSize: 22 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiItem: { flex: 1, minWidth: 100 },
  hint: { ...typography.caption, color: 'rgba(255,255,255,0.75)' },
}),
    [colors, typography, gradients],
  );


  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.title}>Willkommen bei CareSuite+</Text>
          <Text style={styles.meta}>
            Schritt {step + 1} von {totalSteps} — Mandant in wenigen Minuten einrichten
          </Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>🚀</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label="Öffentliches Onboarding" variant="cyan" dot />
        <PremiumBadge label="Keine Speicherung" variant="muted" />
        <PremiumBadge label="Demo-Prototyp" variant="orange" />
      </View>
      <View style={styles.kpiRow}>
        <PremiumKpiCard label="Module" value="6+" subValue="Office · Assist · Pflege" icon="📦" accentColor={colors.orange} style={styles.kpiItem} />
        <PremiumKpiCard label="Portale" value="3" subValue="Team · Klient · Angehörige" icon="🌐" accentColor={colors.cyan} style={styles.kpiItem} />
        <PremiumKpiCard label="Dauer" value="~5 Min" subValue="Demo-Einrichtung" icon="⏱️" accentColor={colors.violet} style={styles.kpiItem} />
      </View>
      <Text style={styles.hint}>
        Dieses Onboarding führt durch die Demo-Einrichtung — kein produktiver Mandant, kein Store-Release.
      </Text>
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;

