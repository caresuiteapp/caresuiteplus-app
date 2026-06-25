import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { usePremiumHeroTextStyles } from '@/design/tokens/carelightadaptive';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import { designTokens, spacing } from '@/theme';

type PrivacySettingsHeroProps = {
  title: string;
  subtitle: string;
  articleLabel: string;
  icon?: string;
};

export function PrivacySettingsHero({
  title,
  subtitle,
  articleLabel,
  icon = '🔒',
}: PrivacySettingsHeroProps) {
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
    borderColor: 'rgba(0,188,212,0.35)',
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
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.meta}>{subtitle}</Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>{icon}</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label={articleLabel} variant="cyan" dot />
        <PremiumBadge label="preparedOnly" variant="muted" />
        <PremiumBadge label="Support-Bearbeitung" variant="orange" dot />
      </View>
      <View style={styles.kpiRow}>
        <PremiumKpiCard label="Bearbeitung" value="Manuell" subValue="Mandanten-Admin / Support" icon="👤" accentColor={colors.cyan} style={styles.kpiItem} />
        <PremiumKpiCard label="Frist" value="30 Tage" subValue="Art. 12 DSGVO" icon="⏱️" accentColor={colors.orange} style={styles.kpiItem} />
        <PremiumKpiCard label="Status" value="Demo" subValue="Kein Auto-Export" icon="📋" accentColor={colors.violet} style={styles.kpiItem} />
      </View>
      <Text style={styles.hint}>
        Anfragen werden dokumentiert und von berechtigten Administratoren bearbeitet — kein automatischer Datenexport.
      </Text>
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;

