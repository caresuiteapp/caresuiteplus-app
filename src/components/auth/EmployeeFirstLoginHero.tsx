import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';

import { designTokens, spacing } from '@/theme';

export function EmployeeFirstLoginHero() {
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
          <Text style={styles.eyebrow}>AUTH · MITARBEITERPORTAL · ERSTLOGIN</Text>
          <Text style={styles.title}>Passwort neu vergeben</Text>
          <Text style={styles.meta}>
            Einmalpasswort ersetzen, Datenschutz bestätigen und Zugang aktivieren
          </Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>🔑</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label="Mitarbeiterportal" variant="cyan" dot />
        <PremiumBadge label="preparedOnly Auth" variant="muted" />
      </View>
      <View style={styles.kpiRow}>
        <PremiumKpiCard
          label="Schritt 1"
          value="Einmal-PW"
          subValue="Vom Admin erhalten"
          icon="📨"
          accentColor={colors.cyan}
          style={styles.kpiItem}
        />
        <PremiumKpiCard
          label="Schritt 2"
          value="Neues PW"
          subValue="Persönlich wählen"
          icon="🔒"
          accentColor={colors.orange}
          style={styles.kpiItem}
        />
        <PremiumKpiCard
          label="Schritt 3"
          value="DSGVO"
          subValue="Bestätigen"
          icon="✓"
          accentColor={colors.violet}
          style={styles.kpiItem}
        />
      </View>
      <Text style={styles.hint}>
        Nach Abschluss wird das Einmalpasswort ungültig. Demo-Prototyp — kein Store-Release.
      </Text>
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;

