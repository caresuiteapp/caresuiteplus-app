import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { usePremiumHeroTextStyles } from '@/design/tokens/carelightadaptive';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import { DEV_TOOL_ENTRIES } from '@/data/navigation/moduleNavConfig';
import { designTokens, spacing } from '@/theme';

export function DeveloperHubHero() {
  const { colors, typography, gradients, mode } = useLegacyTheme();
  const heroText = usePremiumHeroTextStyles();
  const styles = useMemo(
    () =>
      StyleSheet.create({
  topRow: { flexDirection: 'row', gap: spacing.md },
  textCol: { flex: 1, gap: 2 },
  eyebrow: {
    ...typography.caption,
    color: colors.violet,
    letterSpacing: designTokens.hero.eyebrowLetterSpacing,
  },
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
    borderColor: 'rgba(139,92,246,0.35)',
  },
  iconText: { fontSize: 22 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiItem: { flex: 1, minWidth: 100 },
  hint: { ...typography.caption, color: 'rgba(255,255,255,0.75)' },
}),
    [colors, typography, gradients],
  );


  const toolCount = DEV_TOOL_ENTRIES.length;

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.title}>Entwicklerwerkzeuge</Text>
          <Text style={styles.meta}>
            Interne Bereiche — Design System, Architektur und Debug-Routen
          </Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>🛠️</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label="Nur Admins" variant="orange" dot />
        <PremiumBadge label="__DEV__ only" variant="muted" />
        <PremiumBadge label="Nicht öffentlich" variant="cyan" />
      </View>
      <View style={styles.kpiRow}>
        <PremiumKpiCard label="Tools" value={String(toolCount)} subValue="Interne Routen" icon="🔧" accentColor={colors.cyan} style={styles.kpiItem} />
        <PremiumKpiCard label="Design" value="DS" subValue="Token-Katalog" icon="🎨" accentColor={colors.orange} style={styles.kpiItem} />
        <PremiumKpiCard label="Status" value="Dev" subValue="Kein Store-Release" icon="📋" accentColor={colors.violet} style={styles.kpiItem} />
      </View>
      <Text style={styles.hint}>
        Diese Bereiche sind nur für Entwicklung und interne Reviews — nicht Teil des öffentlichen Onboardings.
      </Text>
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;

