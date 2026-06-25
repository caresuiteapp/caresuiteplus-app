import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import { formatFreePlatformPrice } from '@/lib/billing/freePlatformService';
import { designTokens, spacing, typography } from '@/theme';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { usePremiumHeroTextStyles } from '@/design/tokens/carelightadaptive';

export function AuthRegisterHero() {
  const { colors, typography, gradients, mode } = useLegacyTheme();
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
          <Text style={styles.title}>Kostenlos starten</Text>
          <Text style={styles.meta}>
            {formatFreePlatformPrice()} — keine Kreditkarte, kein Checkout
          </Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>🏢</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label="0 € — dauerhaft kostenlos" variant="green" dot />
        <PremiumBadge label="Office inklusive" variant="cyan" />
        <PremiumBadge label="Kein Trial-Ablauf" variant="muted" />
      </View>
      <View style={styles.kpiRow}>
        <PremiumKpiCard label="Basis" value="Office" subValue="Automatisch aktiv" icon="📋" accentColor={colors.orange} style={styles.kpiItem} />
        <PremiumKpiCard label="Module" value="6+" subValue="Kostenlos wählbar" icon="📦" accentColor={colors.cyan} style={styles.kpiItem} />
        <PremiumKpiCard label="Preis" value="0 €" subValue="Kein Abo" icon="✨" accentColor={colors.violet} style={styles.kpiItem} />
      </View>
      <Text style={styles.hint}>
        Nach der Registrierung werden Mandant und Admin-Benutzer angelegt. Alle gewählten Module werden sofort kostenlos aktiviert.
      </Text>
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;
