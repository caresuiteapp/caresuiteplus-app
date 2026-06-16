import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import { designTokens, spacing, typography } from '@/theme';
import { useLegacyTheme } from '@/design/tokens/themeBridge';

export function AuthRegisterHero() {
  const { colors, typography, gradients, mode } = useLegacyTheme();
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
    [colors, typography, gradients],
  );


  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.eyebrow}>REGISTRIERUNG</Text>
          <Text style={styles.title}>Unternehmen anlegen</Text>
          <Text style={styles.meta}>
            Mandant und Admin-Benutzer in wenigen Schritten einrichten
          </Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>🏢</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label="Office inklusive" variant="cyan" />
        <PremiumBadge label="Module wählbar" variant="muted" />
        <PremiumBadge label="Sofort startklar" variant="green" dot />
      </View>
      <View style={styles.kpiRow}>
        <PremiumKpiCard label="Basis" value="Office" subValue="Automatisch aktiv" icon="📋" accentColor={colors.orange} style={styles.kpiItem} />
        <PremiumKpiCard label="Module" value="6+" subValue="Flexibel wählbar" icon="📦" accentColor={colors.cyan} style={styles.kpiItem} />
      </View>
      <Text style={styles.hint}>
        Nach der Registrierung werden Mandant und Admin-Benutzer angelegt. Alle gewählten Module werden sofort aktiviert.
      </Text>
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;
