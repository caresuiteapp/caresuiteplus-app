import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import { defaultPublicVisibility } from '@/lib/ui/uiVisibility';
import { designTokens, spacing } from '@/theme';

type OnboardingWelcomeHeroProps = {
  step: number;
  totalSteps: number;
};

export function OnboardingWelcomeHero({ step, totalSteps }: OnboardingWelcomeHeroProps) {
  const { colors, typography } = useLegacyTheme();
  const visibility = useMemo(() => defaultPublicVisibility(), []);
  const styles = useMemo(
    () =>
      StyleSheet.create({
  topRow: { flexDirection: 'row', gap: spacing.md },
  textCol: { flex: 1, gap: 2 },
  eyebrow: {
    ...typography.caption,
    color: colors.orange,
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
    borderColor: 'rgba(255,176,32,0.35)',
  },
  iconText: { fontSize: 22 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiItem: { flex: 1, minWidth: 100 },
  hint: { ...typography.caption, color: colors.textMuted },
}),
    [colors, typography],
  );


  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.eyebrow}>ONBOARDING</Text>
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
        <PremiumBadge label="Einrichtung" variant="cyan" dot />
        <PremiumBadge label="Module wählbar" variant="muted" />
      </View>
      <View style={styles.kpiRow}>
        <PremiumKpiCard label="Module" value="6+" subValue="Office · Assist · Pflege" icon="📦" accentColor={colors.orange} style={styles.kpiItem} />
        <PremiumKpiCard label="Portale" value="3" subValue="Team · Klient · Angehörige" icon="🌐" accentColor={colors.cyan} style={styles.kpiItem} />
        <PremiumKpiCard label="Dauer" value="~5 Min" subValue="Geführte Einrichtung" icon="⏱️" accentColor={colors.violet} style={styles.kpiItem} />
      </View>
      <Text style={styles.hint}>
        {visibility.showPrototypeInfo
          ? 'Interner Pilotbetrieb — Demo-Einrichtung ohne produktiven Mandanten.'
          : 'Diese Einrichtung führt Sie Schritt für Schritt durch die ersten Einstellungen.'}
      </Text>
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;
