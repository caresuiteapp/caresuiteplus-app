import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import { buildMdShareViewKpis } from '@/lib/qm/qmExtensionStats';
import { isQmExtensionLiveReady, QM_EXTENSION_PREPARED_MESSAGE } from '@/lib/qm/qmModuleConfig';
import { designTokens, spacing } from '@/theme';

type MdShareViewHeroProps = {
  packageTitle: string;
  documentCount: number;
  inspectionYear: number;
};

export function MdShareViewHero({ packageTitle, documentCount, inspectionYear }: MdShareViewHeroProps) {
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
  preparedHint: { ...typography.caption, color: colors.textMuted },
}),
    [colors, typography, gradients],
  );


  const kpis = buildMdShareViewKpis(documentCount, inspectionYear, mode);

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.eyebrow}>MD-FREIGABE</Text>
          <Text style={styles.title}>{packageTitle}</Text>
          <Text style={styles.meta}>Token-validierte Einsicht — kein PDF-Download</Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>👁️</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label="Externe Freigabe" variant="cyan" dot />
        {!isQmExtensionLiveReady() ? (
          <PremiumBadge label="Demo / preparedOnly" variant="muted" />
        ) : null}
      </View>
      <View style={styles.kpiRow}>
        {kpis.map((kpi) => (
          <PremiumKpiCard
            key={kpi.id}
            label={kpi.label}
            value={kpi.value}
            subValue={kpi.subValue}
            icon={kpi.icon}
            accentColor={kpi.accentColor}
            style={styles.kpiItem}
          />
        ))}
      </View>
      {!isQmExtensionLiveReady() ? (
        <Text style={styles.preparedHint}>{QM_EXTENSION_PREPARED_MESSAGE}</Text>
      ) : null}
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;

