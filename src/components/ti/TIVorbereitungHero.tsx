import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import { TI_PREPARED_MESSAGE, isTILiveReady } from '@/lib/ti/tiModuleConfig';
import { isDemoMode } from '@/lib/supabase/config';
import { designTokens, spacing } from '@/theme';

type TIVorbereitungHeroProps = {
  moduleLabel: string;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  accentColor?: string;
};

export function TIVorbereitungHero({
  moduleLabel,
  title,
  subtitle,
  description,
  icon,
  accentColor,
}: TIVorbereitungHeroProps) {
  const { colors, typography, gradients } = useLegacyTheme();
  const accent = accentColor ?? colors.cyan;
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
  },
  iconText: { fontSize: 22 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiItem: { flex: 1, minWidth: 100 },
  desc: { ...typography.body, color: colors.textSecondary },
  hint: { ...typography.caption, color: colors.textMuted },
}),
    [colors, typography, gradients],
  );


  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.eyebrow}>TELEMATIK · TI</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.meta}>{subtitle}</Text>
        </View>
        <View style={[styles.iconBadge, { borderColor: `${accent}55` }]}>
          <Text style={styles.iconText}>{icon}</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label={moduleLabel} variant="cyan" dot />
        {isDemoMode() ? <PremiumBadge label="Demo-Modus" variant="orange" /> : null}
        {!isTILiveReady() ? (
          <PremiumBadge label="TI in Vorbereitung" variant="orange" dot />
        ) : null}
      </View>
      <View style={styles.kpiRow}>
        <PremiumKpiCard
          label="Status"
          value="Prep."
          subValue="Kein Live-TI"
          icon="📡"
          accentColor={colors.violet}
          style={styles.kpiItem}
        />
        <PremiumKpiCard
          label="Connector"
          value="Demo"
          subValue="TI-Gateway"
          icon="🔌"
          accentColor={colors.cyan}
          style={styles.kpiItem}
        />
        <PremiumKpiCard
          label="Compliance"
          value="gematik"
          subValue="Konform geplant"
          icon="🛡️"
          accentColor={colors.success}
          style={styles.kpiItem}
        />
      </View>
      <Text style={styles.desc}>{description}</Text>
      {!isTILiveReady() ? <Text style={styles.hint}>{TI_PREPARED_MESSAGE}</Text> : null}
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;

