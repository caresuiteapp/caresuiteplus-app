import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import { designTokens, spacing } from '@/theme';

export function DemoModeHintHero() {
  const { colors, typography } = useLegacyTheme();
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
    [colors, typography],
  );

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.eyebrow}>AUTH · DEMO · HINWEIS</Text>
          <Text style={styles.title}>Demo mit Beispieldaten</Text>
          <Text style={styles.meta}>Demo-Modus ist derzeit deaktiviert — Live-Pilot nutzt Mandanten-Zugang</Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>ℹ️</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label="Demo deaktiviert" variant="orange" dot />
        <PremiumBadge label="Live-Pilot" variant="cyan" />
        <PremiumBadge label="preparedOnly Auth" variant="muted" />
      </View>
      <View style={styles.kpiRow}>
        <PremiumKpiCard
          label="Env"
          value="false"
          subValue="EXPO_PUBLIC_DEMO_MODE"
          icon="⚙️"
          accentColor={colors.orange}
          style={styles.kpiItem}
        />
        <PremiumKpiCard
          label="Zugang"
          value="Mandant"
          subValue="Unternehmen / Verwaltung"
          icon="🏢"
          accentColor={colors.cyan}
          style={styles.kpiItem}
        />
        <PremiumKpiCard
          label="Status"
          value="Prototyp"
          subValue="Kein Store-Release"
          icon="📋"
          accentColor={colors.violet}
          style={styles.kpiItem}
        />
      </View>
      <Text style={styles.hint}>
        Setzen Sie `EXPO_PUBLIC_DEMO_MODE=true` in `.env` und starten Sie die App neu, um die interaktive
        Demo zu aktivieren.
      </Text>
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;
